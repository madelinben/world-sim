# 🚀 Deployment Guide - GitHub Pages

This guide covers deploying the World Simulator game to GitHub Pages for public access.

## 📋 Prerequisites

- [x] GitHub repository: `madelinben/world-sim`
- [x] `gh-pages` package installed
- [x] Next.js configured for static export
- [x] GitHub Actions workflow created

## 🔧 Configuration Already Complete

The following has been pre-configured for GitHub Pages deployment:

### Next.js Configuration (`next.config.js`)
- Static site generation enabled (`output: 'export'`)
- Proper base path for GitHub Pages (`basePath: '/world-sim'`)
- Asset prefix configured for correct loading
- Image optimization disabled for static export

### Package Scripts (`package.json`)
- `pnpm run export` - Builds static site
- `pnpm run deploy` - Manual deployment to GitHub Pages
- `pnpm run predeploy` - Pre-deployment build step

### Game Landing Page
- Homepage automatically redirects to `/play`
- Play page wrapped in Suspense for static export compatibility

## 🚀 Deployment Steps

### 1. Enable GitHub Pages
1. Go to your GitHub repository: `https://github.com/madelinben/world-sim`
2. Navigate to **Settings** → **Pages**
3. Under **Source**, select **"GitHub Actions"**
4. Save the settings

### 2. Deploy Your Changes

#### Option A: Automatic Deployment (Recommended)
```bash
# Commit and push your changes
git add .
git commit -m "Deploy to GitHub Pages"
git push origin master
```
- GitHub Actions will automatically build and deploy
- Check the **Actions** tab to monitor deployment progress

#### Option B: Manual Deployment
```bash
# Build and deploy manually
pnpm run deploy
```

## 🌐 Production URLs

### Primary Game URL
```
https://madelinben.github.io/world-sim/
```
*Automatically redirects to the game*

### Direct Game URL
```
https://madelinben.github.io/world-sim/play/
```
*Direct access to the World Simulator game*

### Game with Custom Seed
```
https://madelinben.github.io/world-sim/play/?seed=your-seed-here
```
*Replace `your-seed-here` with any string for reproducible worlds*

## 📊 Deployment Status

You can monitor deployment status in several ways:

1. **GitHub Actions Tab**: `https://github.com/madelinben/world-sim/actions`
2. **Repository Settings**: Check Pages section for deployment status
3. **Commit Status**: Green checkmark on commits indicates successful deployment

## 🔄 Automatic Deployment

The GitHub Actions workflow automatically deploys when you:
- Push to the `master` branch
- Push to the `main` branch (if applicable)
- Manually trigger deployment from Actions tab

### Deployment Process
1. **Build**: Compiles Next.js app to static files
2. **Upload**: Uploads build artifacts to GitHub Pages
3. **Deploy**: Makes the site live at production URL
4. **Duration**: Typically takes 2-3 minutes

## 🛠️ Troubleshooting

### Common Issues

**Build Failures**
- Check the Actions tab for error details
- Ensure all dependencies are listed in `package.json`
- Verify `pnpm run export` works locally

**Assets Not Loading**
- Confirm `basePath` and `assetPrefix` are set correctly
- Check that sprite files are in `public/sprites/` directory
- Verify `.nojekyll` file exists in `public/` folder

**Game Not Starting**
- Open browser developer tools for JavaScript errors
- Ensure canvas element is properly initialized
- Check that game assets are accessible

### Manual Verification
Test locally before deploying:
```bash
# Build and test static export
pnpm run export

# Serve the exported files (optional)
npx serve out -p 3000
```

## 📝 Notes

- **First Deployment**: May take 5-10 minutes to propagate
- **Subsequent Deployments**: Usually live within 2-3 minutes
- **Cache**: Browsers may cache the old version; hard refresh if needed
- **HTTPS**: GitHub Pages automatically provides HTTPS

## 🎮 Game Features Available in Production

- ✅ Full world generation with biomes
- ✅ Player movement and controls
- ✅ Tree and cactus systems with growth
- ✅ Inventory system (9 slots)
- ✅ Combat system (attack with Q key)
- ✅ Resource gathering (wood, cactus items)
- ✅ Tile regeneration system
- ✅ Real-time console logging
- ✅ Custom world seeds via URL parameter

---

**Live Game**: https://madelinben.github.io/world-sim/

*Last Updated: Latest deployment*