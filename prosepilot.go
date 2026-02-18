package main

import (
	"bytes"
	"embed"
	"flag"
	"fmt"
	"io/fs"
	"log"
	"mime"
	"net"
	"net/http"
	"os/exec"
	"path"
	"runtime"
	"strings"
	"time"
)

// Set via -ldflags "-X main.buildVersion=...".
var buildVersion = "dev"

//go:embed index.html
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
//go:embed snippet-board/* tic-tac-toe/* time-tracker/* ui-tweaker/*
//go:embed privacy-camera/* privacy-recorder/*
var appFS embed.FS

func main() {
	_ = mime.AddExtensionType(".webmanifest", "application/manifest+json")

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

	if !*noBrowser {
		go func() {
			time.Sleep(220 * time.Millisecond)
			if err := openBrowser(localURL); err != nil {
				log.Printf("browser launch failed: %v", err)
				log.Printf("open manually: %s", localURL)
			}
		}()
	}

	srv := &http.Server{
		Addr:              addr,
		Handler:           logRequests(withHeaders(mux)),
		ReadHeaderTimeout: 5 * time.Second,
	}

	log.Printf("ProSe Pilot launcher %s running", buildVersion)
	if err := srv.Serve(ln); err != nil && err != http.ErrServerClosed {
		log.Fatalf("server error: %v", err)
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
		if r.URL.Path == "/sw.js" || r.URL.Path == "/manifest.webmanifest" {
			w.Header().Set("Cache-Control", "no-cache")
		}
		if strings.HasPrefix(r.URL.Path, "/api/") {
			w.Header().Set("Access-Control-Allow-Origin", "*")
			w.Header().Set("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type,Authorization,X-API-Key")
			w.Header().Set("Cache-Control", "no-store")
			if r.Method == http.MethodOptions {
				w.WriteHeader(http.StatusNoContent)
				return
			}
		}
		next.ServeHTTP(w, r)
	})
}

func logRequests(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		log.Printf("%s %s", r.Method, r.URL.Path)
		next.ServeHTTP(w, r)
	})
}

func printBanner(localURL, lanURL string, share bool, apiEnabled bool, dataDir string, apiKeySet bool) {
	fmt.Println("")
	fmt.Printf("ProSe Pilot Launcher (%s)\n", buildVersion)
	fmt.Printf("Desktop URL: %s\n", localURL)
	if share {
		if lanURL == "" {
			fmt.Println("Phone URL:   unavailable (LAN IP not detected)")
		} else {
			fmt.Printf("Phone URL:   %s\n", lanURL)
		}
		fmt.Println("Mode:        shared on local network")
	} else {
		fmt.Println("Mode:        desktop-only (use --share for phone access)")
	}
	if apiEnabled {
		fmt.Println("API:         enabled")
		fmt.Printf("Data dir:    %s\n", dataDir)
		if apiKeySet {
			fmt.Println("API key:     required for upload/register/heartbeat/chat")
		} else {
			fmt.Println("API key:     not required (set --api-key for protection)")
		}
		fmt.Println("Endpoints:   /api/pulse, /api/media/upload, /api/register, /api/heartbeat, /api/wishlist/submit, /api/support/ticket")
	}
	fmt.Println("Stop:        Ctrl+C")
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
