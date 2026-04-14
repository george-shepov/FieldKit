package main

import (
	"bytes"
	"context"
	"embed"
	"flag"
	"fmt"
	"io/fs"
	"log"
	"math"
	"mime"
	"net"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"os/signal"
	"path"
	"runtime"
	"strings"
	"sync"
	"syscall"
	"time"
)

// Set via -ldflags "-X main.buildVersion=...".
var buildVersion = "dev"

//go:embed index.html landing.html
//go:embed manifest.webmanifest sw.js
//go:embed accent-speaker/* acronym-list/* authority-assistant/* battleship/* clock/* cns-tap-test/* docketpro/* legal-library/*
//go:embed drivers-license/* drivers-license/DriversLicensePrep_files/*
//go:embed employee-skills/* gigtax/*
//go:embed first-aid/*
//go:embed field-checkin/*
//go:embed help/*
//go:embed habit-tracker/* js-trainer/* kanban/* linux-trainer/*
//go:embed inventory/*
//go:embed image-rater/*
//go:embed midi-note-helper/*
//go:embed music-player/*
//go:embed wishlist/*
//go:embed support/*
//go:embed light-messenger/*
//go:embed math-raindrops/* math-trainer/* music-trainer/* odd-one-out/* pattern-mirror/*
//go:embed audio-notes/*
//go:embed outdoor-kit/*
//go:embed positive-iq/*
//go:embed pomodoro/* receipt-tracker/* shared/* snake/*
//go:embed shared/icons/*
//go:embed snippet-board/* tic-tac-toe/* time-tracker/* ui-tweaker/* profile/*
//go:embed privacy-camera/* privacy-recorder/*
//go:embed games/*
//go:embed about/* calisthenics/* convict_conditioning/*
var appFS embed.FS

var apiLimiter = newAPIRateLimiter(10.0, 2.0, 10*time.Minute)

const baselineCSP = "default-src 'self' data: blob:; script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: blob: https://quickchart.io; media-src 'self' data: blob:; font-src 'self' data: https://fonts.gstatic.com; connect-src 'self' http: https: ws: wss:; frame-ancestors 'self'; base-uri 'self'; form-action 'self'"

func main() {
	_ = mime.AddExtensionType(".webmanifest", "application/manifest+json")
	loadDotEnv(".env")

	port := flag.Int("port", 8787, "port to serve on")
	host := flag.String("host", "127.0.0.1", "host to bind to (ignored when --share is used)")
	share := flag.Bool("share", false, "bind to 0.0.0.0 and print LAN URL for phone access")
	noBrowser := flag.Bool("no-browser", false, "do not auto-open browser")
	openPath := flag.String("open", "/", "path to open in browser")
	enableAPI := flag.Bool("enable-api", false, "enable sync/register/heartbeat API endpoints")
	dataDir := flag.String("data-dir", "data", "directory for API uploads and metadata")
	apiKey := flag.String("api-key", "", "optional API key for protected API endpoints")
	flag.Parse()

	bindHost := *host
	if *share {
		bindHost = "0.0.0.0"
	}

	rootFS, err := fs.Sub(appFS, ".")
	if err != nil {
		log.Fatalf("failed to mount embedded assets: %v", err)
	}

	mux := http.NewServeMux()
	if *enableAPI {
		api, err := newAPIServer(*dataDir, *apiKey)
		if err != nil {
			log.Fatalf("failed to initialize API server: %v", err)
		}
		api.mount(mux)
	}
	mux.Handle("/", serveAppRoot(rootFS))

	addr := fmt.Sprintf("%s:%d", bindHost, *port)
	ln, err := net.Listen("tcp", addr)
	if err != nil {
		log.Fatalf("failed to listen on %s: %v", addr, err)
	}
	defer ln.Close()

	localURL := fmt.Sprintf("http://localhost:%d%s", *port, normalizePath(*openPath))
	lanIP := detectLANIP()
	lanURL := ""
	if *share && lanIP != "" {
		lanURL = fmt.Sprintf("http://%s:%d%s", lanIP, *port, normalizePath(*openPath))
	}

	printBanner(localURL, lanURL, *share, *enableAPI, *dataDir, *apiKey != "")
	if *enableAPI && *apiKey == "" {
		log.Printf("WARNING: enableapi is active with no apikey; all API endpoints are unauthenticated - fieldkit.go:112")
	}

	if !*noBrowser {
		go func() {
			time.Sleep(220 * time.Millisecond)
			if err := openBrowser(localURL); err != nil {
				log.Printf("browser launch failed: %v - fieldkit.go:119", err)
				log.Printf("open manually: %s - fieldkit.go:120", localURL)
			}
		}()
	}

	srv := &http.Server{
		Addr:              addr,
		Handler:           logRequests(withHeaders(mux)),
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       30 * time.Second,
		WriteTimeout:      60 * time.Second,
		IdleTimeout:       120 * time.Second,
	}

	log.Printf("FieldKit launcher %s running - fieldkit.go:134", buildVersion)
	serveErr := make(chan error, 1)
	go func() {
		serveErr <- srv.Serve(ln)
	}()

	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, os.Interrupt, syscall.SIGTERM)
	defer signal.Stop(sigCh)

	select {
	case err := <-serveErr:
		if err != nil && err != http.ErrServerClosed {
			log.Fatalf("server error: %v", err)
		}
	case sig := <-sigCh:
		log.Printf("shutdown signal received: %s - fieldkit.go:150", sig)
		ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		if err := srv.Shutdown(ctx); err != nil {
			log.Printf("graceful shutdown failed, forcing close: %v - fieldkit.go:153", err)
			_ = srv.Close()
		}
		cancel()
		if err := <-serveErr; err != nil && err != http.ErrServerClosed {
			log.Printf("server exited with error: %v - fieldkit.go:158", err)
		}
	}
}

func normalizePath(p string) string {
	if p == "" {
		return "/"
	}
	if strings.HasPrefix(p, "/") {
		return p
	}
	return "/" + p
}

func serveAppRoot(root fs.FS) http.Handler {
	fileServer := http.FileServer(http.FS(root))
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if _, ok := resolveUserLandingAlias(r, root); ok {
			serveEmbeddedHTMLWithTweaks(root, "landing.html", w, r)
			return
		}

		if p, ok := resolveHTMLRouteToFSPath(r, root); ok {
			serveEmbeddedHTMLWithTweaks(root, p, w, r)
			return
		}

		if shouldFallbackToLobby(r, root) {
			cloned := new(http.Request)
			*cloned = *r
			urlCopy := *r.URL
			urlCopy.Path = "/index.html"
			cloned.URL = &urlCopy
			fileServer.ServeHTTP(w, cloned)
			return
		}
		fileServer.ServeHTTP(w, r)
	})
}

func shouldFallbackToLobby(r *http.Request, root fs.FS) bool {
	if r.Method != http.MethodGet && r.Method != http.MethodHead {
		return false
	}
	if strings.HasPrefix(r.URL.Path, "/api/") {
		return false
	}
	if !strings.Contains(strings.ToLower(r.Header.Get("Accept")), "text/html") {
		return false
	}

	p := routePathToFSPath(r.URL.Path)
	if p == "" || p == "index.html" {
		return false
	}
	if strings.HasSuffix(r.URL.Path, "/") {
		return !pathExists(root, path.Join(p, "index.html"))
	}
	if pathExists(root, p) {
		return false
	}
	if pathExists(root, path.Join(p, "index.html")) {
		return false
	}
	if !strings.Contains(path.Base(p), ".") && pathExists(root, p+".html") {
		return false
	}
	return true
}

func routePathToFSPath(route string) string {
	cleaned := path.Clean("/" + route)
	cleaned = strings.TrimPrefix(cleaned, "/")
	if cleaned == "." {
		return ""
	}
	return cleaned
}

func pathExists(root fs.FS, p string) bool {
	_, err := fs.Stat(root, p)
	return err == nil
}

func serveEmbeddedFile(root fs.FS, p string, w http.ResponseWriter, r *http.Request) {
	b, err := fs.ReadFile(root, p)
	if err != nil {
		http.NotFound(w, r)
		return
	}
	http.ServeContent(w, r, path.Base(p), time.Time{}, bytes.NewReader(b))
}

func resolveHTMLRouteToFSPath(r *http.Request, root fs.FS) (string, bool) {
	if r.Method != http.MethodGet && r.Method != http.MethodHead {
		return "", false
	}
	p := routePathToFSPath(r.URL.Path)
	if p == "" {
		if pathExists(root, "landing.html") {
			return "landing.html", true
		}
		if pathExists(root, "index.html") {
			return "index.html", true
		}
		return "", false
	}

	if strings.HasSuffix(strings.ToLower(p), ".html") && pathExists(root, p) {
		return p, true
	}
	if strings.HasSuffix(r.URL.Path, "/") {
		idx := path.Join(p, "index.html")
		if pathExists(root, idx) {
			return idx, true
		}
		return "", false
	}
	if !strings.Contains(path.Base(p), ".") {
		idx := path.Join(p, "index.html")
		if pathExists(root, idx) {
			return idx, true
		}
		html := p + ".html"
		if pathExists(root, html) {
			return html, true
		}
	}
	return "", false
}

func resolveUserLandingAlias(r *http.Request, root fs.FS) (string, bool) {
	if r.Method != http.MethodGet && r.Method != http.MethodHead {
		return "", false
	}

	p := routePathToFSPath(r.URL.Path)
	if p == "" {
		return "", false
	}

	segments := strings.Split(p, "/")
	switch len(segments) {
	case 1:
		// Bare vanity route: /shepov
		if segments[0] == "api" || strings.Contains(segments[0], ".") {
			return "", false
		}
		if pathExists(root, segments[0]) || pathExists(root, segments[0]+".html") || pathExists(root, path.Join(segments[0], "index.html")) {
			return "", false
		}
		handle := strings.ToLower(strings.TrimSpace(segments[0]))
		if isValidUserHandle(handle) {
			return handle, true
		}
	case 2:
		// Explicit user routes: /u/shepov or /user/shepov
		prefix := strings.ToLower(strings.TrimSpace(segments[0]))
		if prefix != "u" && prefix != "user" {
			return "", false
		}
		handle := strings.ToLower(strings.TrimSpace(segments[1]))
		if isValidUserHandle(handle) {
			return handle, true
		}
	}
	return "", false
}

func isValidUserHandle(handle string) bool {
	if len(handle) < 3 || len(handle) > 64 {
		return false
	}
	for _, ch := range handle {
		if (ch >= 'a' && ch <= 'z') || (ch >= '0' && ch <= '9') || ch == '.' || ch == '_' || ch == '-' {
			continue
		}
		return false
	}
	return true
}

func serveEmbeddedHTMLWithTweaks(root fs.FS, p string, w http.ResponseWriter, r *http.Request) {
	b, err := fs.ReadFile(root, p)
	if err != nil {
		http.NotFound(w, r)
		return
	}
	injected := injectUITweaksRuntimeScript(b)
	http.ServeContent(w, r, path.Base(p), time.Time{}, bytes.NewReader(injected))
}

func injectUITweaksRuntimeScript(html []byte) []byte {
	const scriptTag = `<script src="/shared/ui-tweaks-runtime.js"></script>`
	if bytes.Contains(html, []byte(scriptTag)) {
		return html
	}

	lower := bytes.ToLower(html)
	bodyClose := []byte("</body>")
	idx := bytes.LastIndex(lower, bodyClose)
	if idx == -1 {
		out := make([]byte, 0, len(html)+len(scriptTag))
		out = append(out, html...)
		out = append(out, []byte(scriptTag)...)
		return out
	}

	out := make([]byte, 0, len(html)+len(scriptTag))
	out = append(out, html[:idx]...)
	out = append(out, []byte(scriptTag)...)
	out = append(out, html[idx:]...)
	return out
}

func withHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("X-Frame-Options", "SAMEORIGIN")
		w.Header().Set("Referrer-Policy", "no-referrer")
		w.Header().Set("Content-Security-Policy", baselineCSP)
		if r.URL.Path == "/sw.js" || r.URL.Path == "/manifest.webmanifest" {
			w.Header().Set("Cache-Control", "no-cache")
		}
		if strings.HasPrefix(r.URL.Path, "/api/") {
			w.Header().Set("Cache-Control", "no-store")
			if r.Method != http.MethodOptions {
				if !apiLimiter.Allow(clientIPFromRequest(r), time.Now()) {
					writeJSON(w, http.StatusTooManyRequests, map[string]any{"error": "rate limit exceeded"})
					return
				}
			}
			origin := strings.TrimSpace(r.Header.Get("Origin"))
			allowedOrigin := origin != "" && isAllowedAPIOrigin(origin, r.Host)
			if allowedOrigin {
				w.Header().Set("Access-Control-Allow-Origin", origin)
				w.Header().Set("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
				w.Header().Set("Access-Control-Allow-Headers", "Content-Type,Authorization,X-API-Key")
				w.Header().Add("Vary", "Origin")
			}
			if r.Method == http.MethodOptions {
				if origin != "" && !allowedOrigin {
					http.Error(w, "forbidden origin", http.StatusForbidden)
					return
				}
				w.Header().Set("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
				w.Header().Set("Access-Control-Allow-Headers", "Content-Type,Authorization,X-API-Key")
				w.WriteHeader(http.StatusNoContent)
				return
			}
		}
		next.ServeHTTP(w, r)
	})
}

type rateBucket struct {
	tokens float64
	last   time.Time
}

type apiRateLimiter struct {
	mu         sync.Mutex
	globalRate float64
	perIPRate  float64
	bucketTTL  time.Duration
	global     rateBucket
	perIP      map[string]*rateBucket
}

func newAPIRateLimiter(globalRate, perIPRate float64, bucketTTL time.Duration) *apiRateLimiter {
	return &apiRateLimiter{
		globalRate: globalRate,
		perIPRate:  perIPRate,
		bucketTTL:  bucketTTL,
		perIP:      make(map[string]*rateBucket),
	}
}

func (l *apiRateLimiter) Allow(ip string, now time.Time) bool {
	if ip == "" {
		ip = "unknown"
	}
	l.mu.Lock()
	defer l.mu.Unlock()

	globalBurst := math.Max(1, l.globalRate*2)
	if !consumeToken(&l.global, l.globalRate, globalBurst, now) {
		return false
	}

	b, ok := l.perIP[ip]
	if !ok {
		b = &rateBucket{}
		l.perIP[ip] = b
	}
	perIPBurst := math.Max(1, l.perIPRate*4)
	if !consumeToken(b, l.perIPRate, perIPBurst, now) {
		return false
	}

	l.gc(now)
	return true
}

func (l *apiRateLimiter) gc(now time.Time) {
	for k, b := range l.perIP {
		if b.last.IsZero() || now.Sub(b.last) <= l.bucketTTL {
			continue
		}
		delete(l.perIP, k)
	}
}

func consumeToken(b *rateBucket, rate, burst float64, now time.Time) bool {
	if rate <= 0 || burst <= 0 {
		return true
	}
	if b.last.IsZero() {
		b.tokens = burst
		b.last = now
	}
	elapsed := now.Sub(b.last).Seconds()
	if elapsed > 0 {
		b.tokens = math.Min(burst, b.tokens+elapsed*rate)
		b.last = now
	}
	if b.tokens < 1 {
		return false
	}
	b.tokens -= 1
	return true
}

func clientIPFromRequest(r *http.Request) string {
	host, _, err := net.SplitHostPort(strings.TrimSpace(r.RemoteAddr))
	if err != nil {
		return strings.TrimSpace(r.RemoteAddr)
	}
	return strings.TrimSpace(host)
}

func isAllowedAPIOrigin(origin, requestHost string) bool {
	u, err := url.Parse(origin)
	if err != nil || u.Host == "" {
		return false
	}
	if u.Scheme != "http" && u.Scheme != "https" {
		return false
	}

	originHost, originPort := splitHostPort(u.Host)
	reqHost, reqPort := splitHostPort(requestHost)
	if strings.EqualFold(u.Host, requestHost) {
		return true
	}
	if originPort != reqPort {
		return false
	}
	return isLoopbackHost(originHost) && isLoopbackHost(reqHost)
}

func splitHostPort(hostport string) (string, string) {
	if h, p, err := net.SplitHostPort(hostport); err == nil {
		return strings.ToLower(strings.Trim(h, "[]")), p
	}
	if strings.HasPrefix(hostport, "[") && strings.HasSuffix(hostport, "]") {
		return strings.ToLower(strings.Trim(hostport, "[]")), ""
	}
	if i := strings.LastIndex(hostport, ":"); i != -1 && strings.Count(hostport, ":") == 1 {
		return strings.ToLower(hostport[:i]), hostport[i+1:]
	}
	return strings.ToLower(hostport), ""
}

func isLoopbackHost(host string) bool {
	host = strings.ToLower(strings.Trim(host, "[]"))
	if host == "localhost" {
		return true
	}
	ip := net.ParseIP(host)
	return ip != nil && ip.IsLoopback()
}

func logRequests(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		log.Printf("%s %s - fieldkit.go:544", r.Method, r.URL.Path)
		next.ServeHTTP(w, r)
	})
}

func printBanner(localURL, lanURL string, share bool, apiEnabled bool, dataDir string, apiKeySet bool) {
	fmt.Println("")
	fmt.Printf("FieldKit Launcher (%s)\n - fieldkit.go:551", buildVersion)
	fmt.Printf("Desktop URL: %s\n - fieldkit.go:552", localURL)
	if share {
		if lanURL == "" {
			fmt.Println("Phone URL:   unavailable (LAN IP not detected) - fieldkit.go:555")
		} else {
			fmt.Printf("Phone URL:   %s\n - fieldkit.go:557", lanURL)
		}
		fmt.Println("Mode:        shared on local network - fieldkit.go:559")
	} else {
		fmt.Println("Mode:        desktoponly (use share for phone access) - fieldkit.go:561")
	}
	if apiEnabled {
		fmt.Println("API:         enabled - fieldkit.go:564")
		fmt.Printf("Data dir:    %s\n - fieldkit.go:565", dataDir)
		if apiKeySet {
			fmt.Println("API key:     required for upload/register/heartbeat/chat - fieldkit.go:567")
		} else {
			fmt.Println("API key:     not required (set apikey for protection) - fieldkit.go:569")
		}
		fmt.Println("Endpoints:   /api/pulse, /api/media/upload, /api/register, /api/heartbeat, /api/wishlist/submit, /api/support/ticket - fieldkit.go:571")
	}
	fmt.Println("Stop:        Ctrl+C - fieldkit.go:573")
	fmt.Println("")
}

func detectLANIP() string {
	if conn, err := net.Dial("udp", "1.1.1.1:80"); err == nil {
		defer conn.Close()
		if localAddr, ok := conn.LocalAddr().(*net.UDPAddr); ok {
			if ip := localAddr.IP.To4(); ip != nil && !ip.IsLoopback() {
				return ip.String()
			}
		}
	}

	ifaces, err := net.Interfaces()
	if err != nil {
		return ""
	}
	for _, iface := range ifaces {
		if iface.Flags&net.FlagUp == 0 || iface.Flags&net.FlagLoopback != 0 {
			continue
		}
		addrs, err := iface.Addrs()
		if err != nil {
			continue
		}
		for _, addr := range addrs {
			var ip net.IP
			switch v := addr.(type) {
			case *net.IPNet:
				ip = v.IP
			case *net.IPAddr:
				ip = v.IP
			}
			ip = ip.To4()
			if ip == nil || ip.IsLoopback() {
				continue
			}
			return ip.String()
		}
	}
	return ""
}

func openBrowser(url string) error {
	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "windows":
		cmd = exec.Command("rundll32", "url.dll,FileProtocolHandler", url)
	case "darwin":
		cmd = exec.Command("open", url)
	default:
		cmd = exec.Command("xdg-open", url)
	}
	return cmd.Start()
}

// loadDotEnv reads key=value pairs from path and sets them as env vars.
// Existing env vars are never overwritten. Silently ignored if file is absent.
func loadDotEnv(path string) {
	data, err := os.ReadFile(path)
	if err != nil {
		return
	}
	for _, line := range strings.Split(string(data), "\n") {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		idx := strings.IndexByte(line, '=')
		if idx < 1 {
			continue
		}
		key := strings.TrimSpace(line[:idx])
		val := strings.TrimSpace(line[idx+1:])
		if len(val) >= 2 && val[0] == val[len(val)-1] && (val[0] == '"' || val[0] == '\'') {
			val = val[1 : len(val)-1]
		}
		if os.Getenv(key) == "" {
			os.Setenv(key, val)
		}
	}
}
