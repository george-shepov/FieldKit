package main

import (
	"bufio"
	crand "crypto/rand"
	"crypto/subtle"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"math/big"
	"mime"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"
)

type googleOAuthCfg struct {
	clientID      string
	clientSecret  string
	redirectURI   string
	allowedEmails map[string]struct{} // nil or empty = allow any verified Google email
}

type oauthStateEntry struct {
	next   string
	expiry time.Time
}

type oauthUser struct {
	Sub     string `json:"sub"`
	Email   string `json:"email"`
	Name    string `json:"name"`
	Picture string `json:"picture"`
}

type apiServer struct {
	dataDir     string
	apiKey      string
	mu          sync.Mutex
	gOAuth      googleOAuthCfg
	oauthStates map[string]oauthStateEntry
	sessions    map[string]oauthUser
}

type registerRequest struct {
	DeviceID         string `json:"deviceId"`
	AppVersion       string `json:"appVersion"`
	Platform         string `json:"platform"`
	OwnerName        string `json:"ownerName"`
	OwnerEmail       string `json:"ownerEmail"`
	EmergencyName    string `json:"emergencyName"`
	EmergencyPhone   string `json:"emergencyPhone"`
	EmergencyEmail   string `json:"emergencyEmail"`
	ConsentEmergency bool   `json:"consentEmergency"`
	Notes            string `json:"notes"`
}

type heartbeatRequest struct {
	DeviceID      string   `json:"deviceId"`
	Status        string   `json:"status"`
	Note          string   `json:"note"`
	BatteryPct    *float64 `json:"batteryPct"`
	Lat           *float64 `json:"lat"`
	Lng           *float64 `json:"lng"`
	OfflineHours  *float64 `json:"offlineHours"`
	LastFieldPlan string   `json:"lastFieldPlan"`
}

type chatSendRequest struct {
	FromDeviceID string `json:"fromDeviceId"`
	ToDeviceID   string `json:"toDeviceId"`
	Text         string `json:"text"`
}

type wishlistRequest struct {
	DeviceID    string  `json:"deviceId"`
	Title       string  `json:"title"`
	Description string  `json:"description"`
	Category    string  `json:"category"`
	Priority    string  `json:"priority"`
	BudgetUSD   float64 `json:"budgetUsd"`
	Timeline    string  `json:"timeline"`
	Contact     string  `json:"contact"`
	Tags        string  `json:"tags"`
}

type supportTicketRequest struct {
	DeviceID     string `json:"deviceId"`
	App          string `json:"app"`
	Subject      string `json:"subject"`
	Description  string `json:"description"`
	Severity     string `json:"severity"`
	Contact      string `json:"contact"`
	Preferred    string `json:"preferredChannel"`
	Screenshot   string `json:"screenshotUrl"`
	ReproSteps   string `json:"reproSteps"`
	Expected     string `json:"expectedBehavior"`
	Actual       string `json:"actualBehavior"`
	AppVersion   string `json:"appVersion"`
	PlatformInfo string `json:"platformInfo"`
}

type chatMessage struct {
	ID           string `json:"id"`
	FromDeviceID string `json:"fromDeviceId"`
	ToDeviceID   string `json:"toDeviceId"`
	Text         string `json:"text"`
	SentAt       string `json:"sentAt"`
}

type chatCursor struct {
	Offset     int64  `json:"offset"`
	LastSentAt string `json:"lastSentAt"`
	UpdatedAt  string `json:"updatedAt"`
}

const maxBodyBytes int64 = 1 << 20 // 1 MiB
const maxUploadBodyBytes int64 = 32 << 20
const maxUploadMemoryBytes int64 = 8 << 20
const maxDailyUploadBytes int64 = 500 << 20
const ndjsonRotateBytes int64 = 50 << 20
const ndjsonRotateGenerations = 2

var (
	errRequestBodyTooLarge = errors.New("request body too large")
	errInvalidJSONBody     = errors.New("invalid json body")
	errInvalidFormBody     = errors.New("invalid form body")
)

func newAPIServer(dataDir, apiKey string) (*apiServer, error) {
	if strings.TrimSpace(dataDir) == "" {
		dataDir = "data"
	}
	allowedEmails := map[string]struct{}{}
	if raw := strings.TrimSpace(os.Getenv("GOOGLE_ALLOWED_EMAILS")); raw != "" {
		for _, e := range strings.Split(raw, ",") {
			if e = strings.ToLower(strings.TrimSpace(e)); e != "" {
				allowedEmails[e] = struct{}{}
			}
		}
	}
	api := &apiServer{
		dataDir: dataDir,
		apiKey:  strings.TrimSpace(apiKey),
		gOAuth: googleOAuthCfg{
			clientID:      strings.TrimSpace(os.Getenv("GOOGLE_LOGIN_CLIENT_ID")),
			clientSecret:  strings.TrimSpace(os.Getenv("GOOGLE_LOGIN_CLIENT_SECRET")),
			redirectURI:   strings.TrimSpace(os.Getenv("GOOGLE_LOGIN_REDIRECT_URI")),
			allowedEmails: allowedEmails,
		},
		oauthStates: make(map[string]oauthStateEntry),
		sessions:    make(map[string]oauthUser),
	}
	dirs := []string{
		filepath.Join(dataDir, "uploads"),
		filepath.Join(dataDir, "registrations"),
		filepath.Join(dataDir, "heartbeats"),
		filepath.Join(dataDir, "chat"),
		filepath.Join(dataDir, "wishlist"),
		filepath.Join(dataDir, "support"),
	}
	for _, d := range dirs {
		if err := os.MkdirAll(d, 0o700); err != nil {
			return nil, err
		}
		if err := os.Chmod(d, 0o700); err != nil {
			return nil, err
		}
	}
	return api, nil
}

func (a *apiServer) mount(mux *http.ServeMux) {
	mux.HandleFunc("/api/pulse", a.handlePulse)
	mux.HandleFunc("/api/media/upload", a.handleMediaUpload)
	mux.HandleFunc("/api/register", a.handleRegister)
	mux.HandleFunc("/api/heartbeat", a.handleHeartbeat)
	mux.HandleFunc("/api/chat/send", a.handleChatSend)
	mux.HandleFunc("/api/chat/poll", a.handleChatPoll)
	mux.HandleFunc("/api/wishlist/submit", a.handleWishlistSubmit)
	mux.HandleFunc("/api/support/ticket", a.handleSupportTicket)
	mux.HandleFunc("/api/auth/session", a.handleAuthSession)
	mux.HandleFunc("/api/auth/logout", a.handleAuthLogout)
	if a.gOAuth.clientID != "" {
		mux.HandleFunc("/api/auth/oauth/google", a.handleGoogleOAuthStart)
		mux.HandleFunc("/api/auth/oauth/google/callback", a.handleGoogleOAuthCallback)
	}
}

func (a *apiServer) handlePulse(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet && r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]any{"error": "method not allowed"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"ok":         true,
		"online":     true,
		"serverTime": time.Now().UTC().Format(time.RFC3339),
	})
}

func (a *apiServer) handleMediaUpload(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]any{"error": "method not allowed"})
		return
	}
	if !a.authorized(r) {
		writeJSON(w, http.StatusUnauthorized, map[string]any{"error": "invalid api key"})
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, maxUploadBodyBytes)
	if err := r.ParseMultipartForm(maxUploadMemoryBytes); err != nil {
		var maxBytesErr *http.MaxBytesError
		if errors.As(err, &maxBytesErr) {
			writeJSON(w, http.StatusRequestEntityTooLarge, map[string]any{"error": "upload too large"})
			return
		}
		writeJSON(w, http.StatusBadRequest, map[string]any{"error": "invalid multipart form"})
		return
	}
	if r.MultipartForm != nil {
		defer r.MultipartForm.RemoveAll()
	}

	src, hdr, err := r.FormFile("file")
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"error": "missing file field"})
		return
	}
	defer src.Close()

	deviceID := safeToken(firstNonEmpty(r.FormValue("deviceId"), "device-unknown"))
	appID := safeToken(firstNonEmpty(r.FormValue("appId"), "unknown-app"))
	clientMediaType := strings.TrimSpace(r.FormValue("mediaType"))
	capturedAt := strings.TrimSpace(r.FormValue("capturedAt"))
	duration := strings.TrimSpace(r.FormValue("durationSec"))
	if capturedAt == "" {
		capturedAt = time.Now().UTC().Format(time.RFC3339)
	}

	bufSrc := bufio.NewReader(src)
	sniff, err := bufSrc.Peek(512)
	if err != nil && !errors.Is(err, io.EOF) {
		writeJSON(w, http.StatusBadRequest, map[string]any{"error": "failed to inspect upload"})
		return
	}
	detectedMediaType := strings.TrimSpace(http.DetectContentType(sniff))
	if !isAllowedUploadContentType(detectedMediaType) {
		writeJSON(w, http.StatusBadRequest, map[string]any{"error": "unsupported upload media type"})
		return
	}

	ext := extensionFromMediaType(detectedMediaType)
	if ext == "" {
		ext = strings.ToLower(filepath.Ext(hdr.Filename))
	}
	if ext == "" {
		ext = extensionFromMediaType(clientMediaType)
	}
	if ext == "" {
		ext = ".dat"
	}

	now := time.Now().UTC()
	usedToday, err := a.dailyUploadBytes(deviceID, now)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]any{"error": "failed to read upload quota"})
		return
	}
	remainingQuota := maxDailyUploadBytes - usedToday
	if remainingQuota <= 0 {
		writeJSON(w, http.StatusTooManyRequests, map[string]any{"error": "daily upload quota exceeded"})
		return
	}

	day := now.Format("2006/01/02")
	targetDir := filepath.Join(a.dataDir, "uploads", deviceID, day)
	if err := os.MkdirAll(targetDir, 0o700); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]any{"error": "failed to prepare storage"})
		return
	}
	if err := os.Chmod(targetDir, 0o700); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]any{"error": "failed to prepare storage"})
		return
	}

	fileID := fmt.Sprintf("%s-%d-%06d", appID, now.UnixMilli(), secureIntn(1_000_000))
	fileName := fileID + ext
	dstPath := filepath.Join(targetDir, fileName)

	dst, err := os.OpenFile(dstPath, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0o600)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]any{"error": "failed to create destination file"})
		return
	}

	size, err := io.Copy(dst, io.LimitReader(bufSrc, remainingQuota+1))
	closeErr := dst.Close()
	if size > remainingQuota {
		_ = os.Remove(dstPath)
		writeJSON(w, http.StatusTooManyRequests, map[string]any{"error": "daily upload quota exceeded"})
		return
	}
	if err != nil {
		_ = os.Remove(dstPath)
		writeJSON(w, http.StatusInternalServerError, map[string]any{"error": "failed to write destination file"})
		return
	}
	if closeErr != nil {
		_ = os.Remove(dstPath)
		writeJSON(w, http.StatusInternalServerError, map[string]any{"error": "failed to close destination file"})
		return
	}

	entry := map[string]any{
		"event":       "upload",
		"receivedAt":  now.Format(time.RFC3339),
		"deviceId":    deviceID,
		"appId":       appID,
		"capturedAt":  capturedAt,
		"durationSec": duration,
		"mediaType":   detectedMediaType,
		"mediaHint":   clientMediaType,
		"sizeBytes":   size,
		"fileID":      fileID,
		"filePath":    filepath.ToSlash(filepath.Join("uploads", deviceID, day, fileName)),
	}
	if err := a.appendJSONLine(filepath.Join(a.dataDir, "uploads.log.ndjson"), entry); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]any{"error": "failed to write upload metadata"})
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"ok":         true,
		"fileID":     fileID,
		"sizeBytes":  size,
		"storedPath": entry["filePath"],
	})
}

func (a *apiServer) handleRegister(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]any{"error": "method not allowed"})
		return
	}
	if !a.authorized(r) {
		writeJSON(w, http.StatusUnauthorized, map[string]any{"error": "invalid api key"})
		return
	}

	req, err := decodeRegisterRequest(w, r)
	if err != nil {
		writeBodyDecodeError(w, err)
		return
	}

	deviceID := safeToken(req.DeviceID)
	if deviceID == "" || deviceID == "unknown" {
		writeJSON(w, http.StatusBadRequest, map[string]any{"error": "deviceId is required"})
		return
	}

	now := time.Now().UTC()
	entry := map[string]any{
		"event":            "register",
		"receivedAt":       now.Format(time.RFC3339),
		"deviceId":         deviceID,
		"appVersion":       strings.TrimSpace(req.AppVersion),
		"platform":         strings.TrimSpace(req.Platform),
		"ownerName":        strings.TrimSpace(req.OwnerName),
		"ownerEmail":       strings.TrimSpace(req.OwnerEmail),
		"emergencyName":    strings.TrimSpace(req.EmergencyName),
		"emergencyPhone":   strings.TrimSpace(req.EmergencyPhone),
		"emergencyEmail":   strings.TrimSpace(req.EmergencyEmail),
		"consentEmergency": req.ConsentEmergency,
		"notes":            strings.TrimSpace(req.Notes),
	}

	if err := a.appendJSONLine(filepath.Join(a.dataDir, "registrations.log.ndjson"), entry); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]any{"error": "failed to write registration log"})
		return
	}

	latestPath := filepath.Join(a.dataDir, "registrations", deviceID+".json")
	if err := a.writeJSONFile(latestPath, entry); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]any{"error": "failed to write latest registration"})
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"ok":         true,
		"deviceId":   deviceID,
		"receivedAt": now.Format(time.RFC3339),
	})
}

func (a *apiServer) handleHeartbeat(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]any{"error": "method not allowed"})
		return
	}
	if !a.authorized(r) {
		writeJSON(w, http.StatusUnauthorized, map[string]any{"error": "invalid api key"})
		return
	}

	var req heartbeatRequest
	if err := decodeJSONBody(w, r, &req); err != nil {
		writeBodyDecodeError(w, err)
		return
	}

	deviceID := safeToken(req.DeviceID)
	if deviceID == "" || deviceID == "unknown" {
		writeJSON(w, http.StatusBadRequest, map[string]any{"error": "deviceId is required"})
		return
	}

	now := time.Now().UTC()
	entry := map[string]any{
		"event":         "heartbeat",
		"receivedAt":    now.Format(time.RFC3339),
		"deviceId":      deviceID,
		"status":        strings.TrimSpace(req.Status),
		"note":          strings.TrimSpace(req.Note),
		"batteryPct":    req.BatteryPct,
		"lat":           req.Lat,
		"lng":           req.Lng,
		"offlineHours":  req.OfflineHours,
		"lastFieldPlan": strings.TrimSpace(req.LastFieldPlan),
	}

	if err := a.appendJSONLine(filepath.Join(a.dataDir, "heartbeats.log.ndjson"), entry); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]any{"error": "failed to write heartbeat log"})
		return
	}
	latestPath := filepath.Join(a.dataDir, "heartbeats", deviceID+".json")
	if err := a.writeJSONFile(latestPath, entry); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]any{"error": "failed to write latest heartbeat"})
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"ok":               true,
		"serverTime":       now.Format(time.RFC3339),
		"staleAfterHours":  24,
		"monitoringAdvice": "create a cron job that alerts if latest heartbeat is stale",
	})
}

func (a *apiServer) handleChatSend(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]any{"error": "method not allowed"})
		return
	}
	if !a.authorized(r) {
		writeJSON(w, http.StatusUnauthorized, map[string]any{"error": "invalid api key"})
		return
	}

	var req chatSendRequest
	if err := decodeJSONBody(w, r, &req); err != nil {
		writeBodyDecodeError(w, err)
		return
	}

	fromID := safeToken(req.FromDeviceID)
	toID := safeToken(firstNonEmpty(req.ToDeviceID, "*"))
	text := strings.TrimSpace(req.Text)
	if fromID == "" || fromID == "unknown" {
		writeJSON(w, http.StatusBadRequest, map[string]any{"error": "fromDeviceId is required"})
		return
	}
	if text == "" {
		writeJSON(w, http.StatusBadRequest, map[string]any{"error": "text is required"})
		return
	}
	if len(text) > 1500 {
		writeJSON(w, http.StatusBadRequest, map[string]any{"error": "text too long"})
		return
	}

	now := time.Now().UTC()
	msg := chatMessage{
		ID:           fmt.Sprintf("%d-%06d", now.UnixMilli(), secureIntn(1_000_000)),
		FromDeviceID: fromID,
		ToDeviceID:   toID,
		Text:         text,
		SentAt:       now.Format(time.RFC3339),
	}
	if err := a.appendJSONLine(filepath.Join(a.dataDir, "chat", "messages.ndjson"), msg); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]any{"error": "failed to store message"})
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "id": msg.ID})
}

func (a *apiServer) handleChatPoll(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]any{"error": "method not allowed"})
		return
	}
	if !a.authorized(r) {
		writeJSON(w, http.StatusUnauthorized, map[string]any{"error": "invalid api key"})
		return
	}

	deviceID := safeToken(r.URL.Query().Get("deviceId"))
	if deviceID == "" || deviceID == "unknown" {
		writeJSON(w, http.StatusBadRequest, map[string]any{"error": "deviceId is required"})
		return
	}

	sinceRaw := strings.TrimSpace(r.URL.Query().Get("since"))
	since, err := parseSinceParam(sinceRaw)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"error": "invalid since"})
		return
	}
	limit := 50
	if raw := strings.TrimSpace(r.URL.Query().Get("limit")); raw != "" {
		if v, err := strconv.Atoi(raw); err == nil && v > 0 && v <= 200 {
			limit = v
		}
	}

	chatPath := filepath.Join(a.dataDir, "chat", "messages.ndjson")
	f, err := os.Open(chatPath)
	if errors.Is(err, os.ErrNotExist) {
		writeJSON(w, http.StatusOK, map[string]any{"ok": true, "messages": []chatMessage{}})
		return
	}
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]any{"error": "failed to open chat log"})
		return
	}
	defer f.Close()

	stat, err := f.Stat()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]any{"error": "failed to stat chat log"})
		return
	}

	startOffset := int64(0)
	cursor, _ := a.readChatCursor(deviceID)
	if cursor.Offset > 0 && cursor.Offset <= stat.Size() {
		cursorLastAt, _ := time.Parse(time.RFC3339, strings.TrimSpace(cursor.LastSentAt))
		if sinceRaw == "" || (!cursorLastAt.IsZero() && (since.After(cursorLastAt) || since.Equal(cursorLastAt))) {
			startOffset = cursor.Offset
		}
	}
	if startOffset > 0 {
		if _, err := f.Seek(startOffset, io.SeekStart); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]any{"error": "failed to seek chat log"})
			return
		}
	}

	scanner := bufio.NewScanner(f)
	scanner.Buffer(make([]byte, 1024), 1024*1024)
	messages := make([]chatMessage, 0, limit)
	offset := startOffset
	lastSentAt := strings.TrimSpace(cursor.LastSentAt)
	for scanner.Scan() {
		// json.Encoder writes each entry with '\n'; track offsets to resume later.
		offset += int64(len(scanner.Bytes()) + 1)
		var msg chatMessage
		if err := json.Unmarshal(scanner.Bytes(), &msg); err != nil {
			continue
		}
		ts, err := time.Parse(time.RFC3339, msg.SentAt)
		if err != nil {
			continue
		}
		lastSentAt = ts.UTC().Format(time.RFC3339)
		if ts.Before(since) || ts.Equal(since) {
			continue
		}
		if msg.ToDeviceID != "*" && msg.ToDeviceID != deviceID && msg.FromDeviceID != deviceID {
			continue
		}
		messages = append(messages, msg)
		if len(messages) > limit {
			messages = messages[len(messages)-limit:]
		}
	}
	if err := scanner.Err(); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]any{"error": "failed to read chat log"})
		return
	}
	if offset > 0 {
		_ = a.writeChatCursor(deviceID, chatCursor{
			Offset:     offset,
			LastSentAt: lastSentAt,
			UpdatedAt:  time.Now().UTC().Format(time.RFC3339),
		})
	}

	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "messages": messages})
}

func (a *apiServer) handleWishlistSubmit(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]any{"error": "method not allowed"})
		return
	}
	if !a.authorized(r) {
		writeJSON(w, http.StatusUnauthorized, map[string]any{"error": "invalid api key"})
		return
	}

	var req wishlistRequest
	if err := decodeJSONBody(w, r, &req); err != nil {
		writeBodyDecodeError(w, err)
		return
	}
	if strings.TrimSpace(req.Title) == "" {
		writeJSON(w, http.StatusBadRequest, map[string]any{"error": "title is required"})
		return
	}

	deviceID := safeToken(firstNonEmpty(req.DeviceID, "device-unknown"))
	now := time.Now().UTC()
	itemID := fmt.Sprintf("wish-%d-%06d", now.UnixMilli(), secureIntn(1_000_000))
	entry := map[string]any{
		"id":          itemID,
		"event":       "wishlist-submit",
		"receivedAt":  now.Format(time.RFC3339),
		"deviceId":    deviceID,
		"title":       strings.TrimSpace(req.Title),
		"description": strings.TrimSpace(req.Description),
		"category":    strings.TrimSpace(req.Category),
		"priority":    strings.TrimSpace(req.Priority),
		"budgetUsd":   req.BudgetUSD,
		"timeline":    strings.TrimSpace(req.Timeline),
		"contact":     strings.TrimSpace(req.Contact),
		"tags":        strings.TrimSpace(req.Tags),
		"status":      "new",
	}

	if err := a.appendJSONLine(filepath.Join(a.dataDir, "wishlist", "submissions.ndjson"), entry); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]any{"error": "failed to store wishlist item"})
		return
	}

	latestPath := filepath.Join(a.dataDir, "wishlist", itemID+".json")
	if err := a.writeJSONFile(latestPath, entry); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]any{"error": "failed to write wishlist item"})
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"ok":         true,
		"id":         itemID,
		"receivedAt": now.Format(time.RFC3339),
		"status":     "new",
	})
}

func (a *apiServer) handleSupportTicket(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]any{"error": "method not allowed"})
		return
	}
	if !a.authorized(r) {
		writeJSON(w, http.StatusUnauthorized, map[string]any{"error": "invalid api key"})
		return
	}

	var req supportTicketRequest
	if err := decodeJSONBody(w, r, &req); err != nil {
		writeBodyDecodeError(w, err)
		return
	}
	if strings.TrimSpace(req.Subject) == "" {
		writeJSON(w, http.StatusBadRequest, map[string]any{"error": "subject is required"})
		return
	}
	if strings.TrimSpace(req.Description) == "" {
		writeJSON(w, http.StatusBadRequest, map[string]any{"error": "description is required"})
		return
	}

	deviceID := safeToken(firstNonEmpty(req.DeviceID, "device-unknown"))
	now := time.Now().UTC()
	ticketID := fmt.Sprintf("ticket-%d-%06d", now.UnixMilli(), secureIntn(1_000_000))
	entry := map[string]any{
		"id":               ticketID,
		"event":            "support-ticket",
		"receivedAt":       now.Format(time.RFC3339),
		"status":           "open",
		"deviceId":         deviceID,
		"app":              strings.TrimSpace(req.App),
		"subject":          strings.TrimSpace(req.Subject),
		"description":      strings.TrimSpace(req.Description),
		"severity":         strings.TrimSpace(req.Severity),
		"contact":          strings.TrimSpace(req.Contact),
		"preferredChannel": strings.TrimSpace(req.Preferred),
		"screenshotUrl":    strings.TrimSpace(req.Screenshot),
		"reproSteps":       strings.TrimSpace(req.ReproSteps),
		"expectedBehavior": strings.TrimSpace(req.Expected),
		"actualBehavior":   strings.TrimSpace(req.Actual),
		"appVersion":       strings.TrimSpace(req.AppVersion),
		"platformInfo":     strings.TrimSpace(req.PlatformInfo),
	}

	if err := a.appendJSONLine(filepath.Join(a.dataDir, "support", "tickets.ndjson"), entry); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]any{"error": "failed to store support ticket"})
		return
	}
	latestPath := filepath.Join(a.dataDir, "support", ticketID+".json")
	if err := a.writeJSONFile(latestPath, entry); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]any{"error": "failed to write support ticket"})
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"ok":         true,
		"id":         ticketID,
		"receivedAt": now.Format(time.RFC3339),
		"status":     "open",
	})
}

func decodeRegisterRequest(w http.ResponseWriter, r *http.Request) (registerRequest, error) {
	var req registerRequest
	ct := strings.ToLower(strings.TrimSpace(r.Header.Get("Content-Type")))
	if strings.Contains(ct, "application/json") {
		if err := decodeJSONBody(w, r, &req); err != nil {
			return req, err
		}
		return req, nil
	}

	r.Body = http.MaxBytesReader(w, r.Body, maxBodyBytes)
	if err := r.ParseForm(); err != nil {
		var maxBytesErr *http.MaxBytesError
		if errors.As(err, &maxBytesErr) {
			return req, errRequestBodyTooLarge
		}
		return req, errInvalidFormBody
	}
	req.DeviceID = r.FormValue("deviceId")
	req.AppVersion = r.FormValue("appVersion")
	req.Platform = r.FormValue("platform")
	req.OwnerName = r.FormValue("ownerName")
	req.OwnerEmail = r.FormValue("ownerEmail")
	req.EmergencyName = r.FormValue("emergencyName")
	req.EmergencyPhone = r.FormValue("emergencyPhone")
	req.EmergencyEmail = r.FormValue("emergencyEmail")
	req.ConsentEmergency = parseBoolLike(r.FormValue("consentEmergency"))
	req.Notes = r.FormValue("notes")
	return req, nil
}

func parseBoolLike(v string) bool {
	s := strings.ToLower(strings.TrimSpace(v))
	return s == "1" || s == "true" || s == "yes" || s == "on"
}

func (a *apiServer) authorized(r *http.Request) bool {
	if a.apiKey == "" {
		return true
	}
	candidates := []string{
		strings.TrimSpace(strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")),
		strings.TrimSpace(r.Header.Get("X-API-Key")),
		strings.TrimSpace(r.URL.Query().Get("apiKey")),
	}
	for _, c := range candidates {
		if c == "" {
			continue
		}
		if subtle.ConstantTimeCompare([]byte(c), []byte(a.apiKey)) == 1 {
			return true
		}
	}
	return false
}

func (a *apiServer) appendJSONLine(path string, entry any) error {
	a.mu.Lock()
	defer a.mu.Unlock()

	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return err
	}
	if err := os.Chmod(filepath.Dir(path), 0o700); err != nil {
		return err
	}
	if err := rotateNDJSONIfNeeded(path); err != nil {
		return err
	}
	f, err := os.OpenFile(path, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0o600)
	if err != nil {
		return err
	}
	defer f.Close()
	if err := os.Chmod(path, 0o600); err != nil {
		return err
	}

	enc := json.NewEncoder(f)
	return enc.Encode(entry)
}

func (a *apiServer) writeJSONFile(path string, payload any) error {
	a.mu.Lock()
	defer a.mu.Unlock()

	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return err
	}
	if err := os.Chmod(filepath.Dir(path), 0o700); err != nil {
		return err
	}
	tmpPath := path + ".tmp"
	b, err := json.MarshalIndent(payload, "", "  ")
	if err != nil {
		return err
	}
	if err := os.WriteFile(tmpPath, b, 0o600); err != nil {
		return err
	}
	if err := os.Rename(tmpPath, path); err != nil {
		return err
	}
	return os.Chmod(path, 0o600)
}

func rotateNDJSONIfNeeded(path string) error {
	stat, err := os.Stat(path)
	if errors.Is(err, os.ErrNotExist) {
		return nil
	}
	if err != nil {
		return err
	}
	if stat.Size() < ndjsonRotateBytes {
		return nil
	}

	if ndjsonRotateGenerations < 1 {
		return os.Remove(path)
	}

	oldest := fmt.Sprintf("%s.%d", path, ndjsonRotateGenerations)
	if err := os.Remove(oldest); err != nil && !errors.Is(err, os.ErrNotExist) {
		return err
	}

	for i := ndjsonRotateGenerations - 1; i >= 1; i-- {
		src := fmt.Sprintf("%s.%d", path, i)
		dst := fmt.Sprintf("%s.%d", path, i+1)
		if err := os.Rename(src, dst); err != nil && !errors.Is(err, os.ErrNotExist) {
			return err
		}
	}

	return os.Rename(path, path+".1")
}

func (a *apiServer) chatCursorPath(deviceID string) string {
	return filepath.Join(a.dataDir, "chat", "cursors", deviceID+".json")
}

func (a *apiServer) readChatCursor(deviceID string) (chatCursor, error) {
	path := a.chatCursorPath(deviceID)
	b, err := os.ReadFile(path)
	if err != nil {
		return chatCursor{}, err
	}
	var cursor chatCursor
	if err := json.Unmarshal(b, &cursor); err != nil {
		return chatCursor{}, err
	}
	return cursor, nil
}

func (a *apiServer) writeChatCursor(deviceID string, cursor chatCursor) error {
	return a.writeJSONFile(a.chatCursorPath(deviceID), cursor)
}

func (a *apiServer) dailyUploadBytes(deviceID string, now time.Time) (int64, error) {
	logPath := filepath.Join(a.dataDir, "uploads.log.ndjson")
	f, err := os.Open(logPath)
	if errors.Is(err, os.ErrNotExist) {
		return 0, nil
	}
	if err != nil {
		return 0, err
	}
	defer f.Close()

	dayPrefix := now.UTC().Format("2006-01-02")
	var total int64
	scanner := bufio.NewScanner(f)
	scanner.Buffer(make([]byte, 1024), 1024*1024)
	for scanner.Scan() {
		var row struct {
			DeviceID   string `json:"deviceId"`
			ReceivedAt string `json:"receivedAt"`
			SizeBytes  int64  `json:"sizeBytes"`
		}
		if err := json.Unmarshal(scanner.Bytes(), &row); err != nil {
			continue
		}
		if row.DeviceID != deviceID {
			continue
		}
		if !strings.HasPrefix(strings.TrimSpace(row.ReceivedAt), dayPrefix) {
			continue
		}
		if row.SizeBytes > 0 {
			total += row.SizeBytes
		}
	}
	if err := scanner.Err(); err != nil {
		return 0, err
	}
	return total, nil
}

func isAllowedUploadContentType(contentType string) bool {
	contentType = strings.ToLower(strings.TrimSpace(contentType))
	if contentType == "" || contentType == "application/octet-stream" {
		return false
	}
	return strings.HasPrefix(contentType, "image/") ||
		strings.HasPrefix(contentType, "video/") ||
		strings.HasPrefix(contentType, "audio/")
}

func decodeJSONBody(w http.ResponseWriter, r *http.Request, dst any) error {
	r.Body = http.MaxBytesReader(w, r.Body, maxBodyBytes)
	dec := json.NewDecoder(r.Body)
	if err := dec.Decode(dst); err != nil {
		var maxBytesErr *http.MaxBytesError
		if errors.As(err, &maxBytesErr) {
			return errRequestBodyTooLarge
		}
		return errInvalidJSONBody
	}
	return nil
}

func writeBodyDecodeError(w http.ResponseWriter, err error) {
	if errors.Is(err, errRequestBodyTooLarge) {
		writeJSON(w, http.StatusRequestEntityTooLarge, map[string]any{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusBadRequest, map[string]any{"error": err.Error()})
}

func extensionFromMediaType(mediaType string) string {
	mt := strings.ToLower(strings.TrimSpace(mediaType))
	switch mt {
	case "image/jpeg", "image/jpg":
		return ".jpg"
	case "image/png":
		return ".png"
	case "image/webp":
		return ".webp"
	case "video/webm":
		return ".webm"
	case "video/mp4":
		return ".mp4"
	case "audio/webm":
		return ".weba"
	}
	if mt == "" {
		return ""
	}
	if exts, _ := mime.ExtensionsByType(mt); len(exts) > 0 {
		return exts[0]
	}
	return ""
}

func parseSinceParam(raw string) (time.Time, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return time.Unix(0, 0).UTC(), nil
	}
	if ts, err := strconv.ParseInt(raw, 10, 64); err == nil {
		if ts > 1_000_000_000_000 {
			return time.UnixMilli(ts).UTC(), nil
		}
		return time.Unix(ts, 0).UTC(), nil
	}
	return time.Parse(time.RFC3339, raw)
}

func safeToken(v string) string {
	v = strings.ToLower(strings.TrimSpace(v))
	if v == "" {
		return "unknown"
	}
	var b strings.Builder
	prevDash := false
	for _, r := range v {
		ok := (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9')
		if ok {
			b.WriteRune(r)
			prevDash = false
			continue
		}
		if !prevDash {
			b.WriteByte('-')
			prevDash = true
		}
	}
	out := strings.Trim(b.String(), "-")
	if out == "" {
		return "unknown"
	}
	if len(out) > 64 {
		return out[:64]
	}
	return out
}

func firstNonEmpty(values ...string) string {
	for _, v := range values {
		if strings.TrimSpace(v) != "" {
			return strings.TrimSpace(v)
		}
	}
	return ""
}

func secureIntn(max int64) int64 {
	if max <= 0 {
		return 0
	}
	n, err := crand.Int(crand.Reader, big.NewInt(max))
	if err != nil {
		return time.Now().UnixNano() % max
	}
	return n.Int64()
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}

// ── Google OAuth ──────────────────────────────────────────────────────────────

const (
	oauthStateTTL     = 10 * time.Minute
	sessionCookieName = "pp_session"
	sessionMaxAge     = 30 * 24 * 60 * 60 // 30 days in seconds
)

func secureToken(n int) (string, error) {
	b := make([]byte, n)
	if _, err := crand.Read(b); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}

func (a *apiServer) handleGoogleOAuthStart(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	state, err := secureToken(16)
	if err != nil {
		http.Error(w, "server error", http.StatusInternalServerError)
		return
	}
	next := strings.TrimSpace(r.URL.Query().Get("next"))
	if next == "" || !strings.HasPrefix(next, "/") {
		next = "/index.html"
	}
	now := time.Now()
	a.mu.Lock()
	for k, v := range a.oauthStates {
		if now.After(v.expiry) {
			delete(a.oauthStates, k)
		}
	}
	a.oauthStates[state] = oauthStateEntry{next: next, expiry: now.Add(oauthStateTTL)}
	a.mu.Unlock()
	params := url.Values{
		"client_id":     {a.gOAuth.clientID},
		"redirect_uri":  {a.gOAuth.redirectURI},
		"response_type": {"code"},
		"scope":         {"openid email profile"},
		"state":         {state},
		"prompt":        {"select_account"},
	}
	http.Redirect(w, r, "https://accounts.google.com/o/oauth2/v2/auth?"+params.Encode(), http.StatusFound)
}

func (a *apiServer) handleGoogleOAuthCallback(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	q := r.URL.Query()
	state, code, errParam := q.Get("state"), q.Get("code"), q.Get("error")
	if errParam != "" {
		log.Printf("oauth/google: provider error: %s", errParam)
		http.Error(w, "authentication was cancelled or failed", http.StatusForbidden)
		return
	}
	if state == "" || code == "" {
		http.Error(w, "missing state or code", http.StatusBadRequest)
		return
	}
	a.mu.Lock()
	entry, ok := a.oauthStates[state]
	if ok {
		delete(a.oauthStates, state)
	}
	a.mu.Unlock()
	if !ok || time.Now().After(entry.expiry) {
		http.Error(w, "invalid or expired state; please try again", http.StatusBadRequest)
		return
	}
	accessToken, err := exchangeGoogleCode(a.gOAuth.clientID, a.gOAuth.clientSecret, a.gOAuth.redirectURI, code)
	if err != nil {
		log.Printf("oauth/google: code exchange failed: %v", err)
		http.Error(w, "authentication failed", http.StatusUnauthorized)
		return
	}
	user, err := fetchGoogleUserInfo(accessToken)
	if err != nil {
		log.Printf("oauth/google: userinfo failed: %v", err)
		http.Error(w, "failed to fetch user info", http.StatusUnauthorized)
		return
	}
	if len(a.gOAuth.allowedEmails) > 0 {
		if _, allowed := a.gOAuth.allowedEmails[strings.ToLower(user.Email)]; !allowed {
			log.Printf("oauth/google: access denied for %s", user.Email)
			http.Error(w, "access denied", http.StatusForbidden)
			return
		}
	}
	sessionToken, err := secureToken(32)
	if err != nil {
		http.Error(w, "server error", http.StatusInternalServerError)
		return
	}
	a.mu.Lock()
	a.sessions[sessionToken] = *user
	a.mu.Unlock()
	secure := r.TLS != nil || strings.EqualFold(r.Header.Get("X-Forwarded-Proto"), "https")
	http.SetCookie(w, &http.Cookie{
		Name:     sessionCookieName,
		Value:    sessionToken,
		Path:     "/",
		MaxAge:   sessionMaxAge,
		HttpOnly: true,
		Secure:   secure,
		SameSite: http.SameSiteLaxMode,
	})
	http.Redirect(w, r, entry.next, http.StatusFound)
}

func (a *apiServer) lookupSession(r *http.Request) (*oauthUser, bool) {
	c, err := r.Cookie(sessionCookieName)
	if err != nil || c.Value == "" {
		return nil, false
	}
	a.mu.Lock()
	u, ok := a.sessions[c.Value]
	a.mu.Unlock()
	if !ok {
		return nil, false
	}
	return &u, true
}

func (a *apiServer) handleAuthSession(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	u, ok := a.lookupSession(r)
	if !ok {
		writeJSON(w, http.StatusOK, map[string]any{"signedIn": false})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"signedIn": true,
		"email":    u.Email,
		"name":     u.Name,
		"picture":  u.Picture,
	})
}

func (a *apiServer) handleAuthLogout(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if c, err := r.Cookie(sessionCookieName); err == nil && c.Value != "" {
		a.mu.Lock()
		delete(a.sessions, c.Value)
		a.mu.Unlock()
	}
	http.SetCookie(w, &http.Cookie{
		Name:     sessionCookieName,
		Value:    "",
		Path:     "/",
		MaxAge:   -1,
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
	})
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

type googleTokenResp struct {
	AccessToken string `json:"access_token"`
	Error       string `json:"error"`
	ErrorDesc   string `json:"error_description"`
}

func exchangeGoogleCode(clientID, clientSecret, redirectURI, code string) (string, error) {
	vals := url.Values{
		"code":          {code},
		"client_id":     {clientID},
		"client_secret": {clientSecret},
		"redirect_uri":  {redirectURI},
		"grant_type":    {"authorization_code"},
	}
	c := &http.Client{Timeout: 15 * time.Second}
	resp, err := c.PostForm("https://oauth2.googleapis.com/token", vals)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	var tr googleTokenResp
	if err := json.NewDecoder(io.LimitReader(resp.Body, 8192)).Decode(&tr); err != nil {
		return "", err
	}
	if tr.Error != "" {
		return "", fmt.Errorf("%s: %s", tr.Error, tr.ErrorDesc)
	}
	return tr.AccessToken, nil
}

func fetchGoogleUserInfo(accessToken string) (*oauthUser, error) {
	req, err := http.NewRequest(http.MethodGet, "https://www.googleapis.com/oauth2/v2/userinfo", nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+accessToken)
	c := &http.Client{Timeout: 15 * time.Second}
	resp, err := c.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("userinfo status %d", resp.StatusCode)
	}
	var raw struct {
		ID            string `json:"id"`
		Email         string `json:"email"`
		VerifiedEmail bool   `json:"verified_email"`
		Name          string `json:"name"`
		Picture       string `json:"picture"`
	}
	if err := json.NewDecoder(io.LimitReader(resp.Body, 8192)).Decode(&raw); err != nil {
		return nil, err
	}
	if !raw.VerifiedEmail {
		return nil, fmt.Errorf("google account email not verified")
	}
	return &oauthUser{Sub: raw.ID, Email: raw.Email, Name: raw.Name, Picture: raw.Picture}, nil
}
