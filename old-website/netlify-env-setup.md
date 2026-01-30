# Netlify Environment Variable Setup

## Download URL Configuration

The download button uses a replaceable placeholder that can be configured in Netlify.

### HTML Placeholder
In `download.html`, the download button contains:
```html
<a href="#" ... data-download-url="%%DOWNLOAD_LAUNCHER%%">
```

### How to Configure in Netlify

1. **Build Settings** → Go to Site Settings → Build & Deploy → Post Processing
2. **Snippet Injection** or **Environment Variables**

#### Option 1: Using Post Processing (Recommended)
Add this to your `netlify.toml`:
```toml
[[plugins]]
  package = "@netlify/plugin-sitemap"

[build.environment]
  DOWNLOAD_LAUNCHER = "https://your-download-url.com/PrismMTR-Launcher.exe"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
  force = false
```

#### Option 2: Using Build Command
Update your build command in `netlify.toml`:
```toml
[build]
  command = "sed -i 's|%%DOWNLOAD_LAUNCHER%%|https://your-download-url.com/PrismMTR-Launcher.exe|g' download.html"
  publish = "."
```

#### Option 3: Manual Replacement (Easiest)
Before deploying, simply replace `%%DOWNLOAD_LAUNCHER%%` in `download.html` with your actual download URL.

### Fallback
If the placeholder is not replaced, the JavaScript will use the default value defined in `js/download.js`:
```javascript
const DOWNLOAD_LAUNCHER = 'https://example.com/PrismMTR-Launcher.exe';
```

Update this default URL in `download.js` if needed.
