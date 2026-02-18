package main

import (
	"bufio"
	"crypto/subtle"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math/rand"
	"mime"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"
)

type apiServer struct {
	dataDir string
	apiKey  string
	mu      sync.Mutex
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

func newAPIServer(dataDir, apiKey string) (*apiServer, error) {
	if strings.TrimSpace(dataDir) == "" {
		dataDir = "data"
	}
	api := &apiServer{
		dataDir: dataDir,
		apiKey:  strings.TrimSpace(apiKey),
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
		if err := os.MkdirAll(d, 0o755); err != nil {
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

	if err := r.ParseMultipartForm(256 << 20); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"error": "invalid multipart form"})
		return
	}

	src, hdr, err := r.FormFile("file")
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"error": "missing file field"})
		return
	}
	defer src.Close()

	deviceID := safeToken(firstNonEmpty(r.FormValue("deviceId"), "device-unknown"))
	appID := safeToken(firstNonEmpty(r.FormValue("appId"), "unknown-app"))
	mediaType := strings.TrimSpace(r.FormValue("mediaType"))
	capturedAt := strings.TrimSpace(r.FormValue("capturedAt"))
	duration := strings.TrimSpace(r.FormValue("durationSec"))
	if capturedAt == "" {
		capturedAt = time.Now().UTC().Format(time.RFC3339)
	}

	ext := strings.ToLower(filepath.Ext(hdr.Filename))
	if ext == "" {
		ext = extensionFromMediaType(mediaType)
	}
	if ext == "" {
		ext = ".bin"
	}

	now := time.Now().UTC()
	day := now.Format("2006/01/02")
	targetDir := filepath.Join(a.dataDir, "uploads", deviceID, day)
	if err := os.MkdirAll(targetDir, 0o755); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]any{"error": "failed to prepare storage"})
		return
	}

	fileID := fmt.Sprintf("%s-%d-%06d", appID, now.UnixMilli(), rand.Intn(1_000_000))
	fileName := fileID + ext
	dstPath := filepath.Join(targetDir, fileName)

	dst, err := os.Create(dstPath)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]any{"error": "failed to create destination file"})
		return
	}

	size, err := io.Copy(dst, src)
	closeErr := dst.Close()
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
		"mediaType":   mediaType,
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

	req, err := decodeRegisterRequest(r)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"error": err.Error()})
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
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"error": "invalid json body"})
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
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"error": "invalid json body"})
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
		ID:           fmt.Sprintf("%d-%06d", now.UnixMilli(), rand.Intn(1_000_000)),
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

	since, err := parseSinceParam(r.URL.Query().Get("since"))
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

	scanner := bufio.NewScanner(f)
	scanner.Buffer(make([]byte, 1024), 1024*1024)
	messages := make([]chatMessage, 0, limit)
	for scanner.Scan() {
		var msg chatMessage
		if err := json.Unmarshal(scanner.Bytes(), &msg); err != nil {
			continue
		}
		ts, err := time.Parse(time.RFC3339, msg.SentAt)
		if err != nil {
			continue
		}
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
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"error": "invalid json body"})
		return
	}
	if strings.TrimSpace(req.Title) == "" {
		writeJSON(w, http.StatusBadRequest, map[string]any{"error": "title is required"})
		return
	}

	deviceID := safeToken(firstNonEmpty(req.DeviceID, "device-unknown"))
	now := time.Now().UTC()
	itemID := fmt.Sprintf("wish-%d-%06d", now.UnixMilli(), rand.Intn(1_000_000))
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
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"error": "invalid json body"})
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
	ticketID := fmt.Sprintf("ticket-%d-%06d", now.UnixMilli(), rand.Intn(1_000_000))
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

func decodeRegisterRequest(r *http.Request) (registerRequest, error) {
	var req registerRequest
	ct := strings.ToLower(strings.TrimSpace(r.Header.Get("Content-Type")))
	if strings.Contains(ct, "application/json") {
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			return req, errors.New("invalid json body")
		}
		return req, nil
	}

	if err := r.ParseForm(); err != nil {
		return req, errors.New("invalid form body")
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

	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	f, err := os.OpenFile(path, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0o644)
	if err != nil {
		return err
	}
	defer f.Close()

	enc := json.NewEncoder(f)
	return enc.Encode(entry)
}

func (a *apiServer) writeJSONFile(path string, payload any) error {
	a.mu.Lock()
	defer a.mu.Unlock()

	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	tmpPath := path + ".tmp"
	b, err := json.MarshalIndent(payload, "", "  ")
	if err != nil {
		return err
	}
	if err := os.WriteFile(tmpPath, b, 0o644); err != nil {
		return err
	}
	return os.Rename(tmpPath, path)
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

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}
