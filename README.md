# Image2PDF — Android-first image to PDF converter

A mobile-first, watermark-free image-to-PDF web app. It converts images locally in the browser using `pdf-lib`; no account, backend, database, or upload service is used.

## Requirements
- Node.js 18.0 or newer (Node.js 20 LTS recommended)
- npm

## Run locally (Windows)
1. Extract this ZIP.
2. Open the extracted `image2pdf-android` folder in VS Code.
3. Open Terminal → New Terminal.
4. Run:

```bash
npm install
npm run dev
```

5. Open the local URL shown by Vite, usually `http://localhost:5173`.

## Create a production build

```bash
npm run build
npm run preview
```

The deployable production files are generated in the `dist` folder.

## Deploy free on Vercel
1. Create a GitHub repository and upload the contents of this project folder.
2. Sign in to Vercel and choose **Add New → Project**.
3. Import the GitHub repository.
4. Keep the detected Vite settings:
   - Build command: `npm run build`
   - Output directory: `dist`
5. Click **Deploy**.
6. Open the HTTPS deployment URL on Android Chrome.

## Install on Android
1. Open the deployed HTTPS website in Chrome.
2. Tap the three-dot menu.
3. Choose **Install app** or **Add to Home screen**.
4. Confirm. The Image2PDF icon will appear on your home screen.

The app also has an Install app button. Chrome may show its own install prompt when the browser considers the site eligible.

## Features
- Multiple image selection from Android gallery / file picker
- JPG, PNG and WEBP inputs supported when the browser can decode them
- Image thumbnails and ordering controls
- Remove individual images or clear all
- A4, US Letter and original-size pages
- Auto, portrait and landscape orientation
- No, small and large margins
- Local image normalization and PDF generation
- Downloadable PDF with a user-defined filename
- Basic offline app-shell caching after first successful visit

## Notes and limitations
- The browser must be able to decode the chosen image. Most Android JPG, PNG and WEBP images work. Some HEIC/HEIF files are not supported by all Android browsers; save/export those as JPG first if they fail.
- Images are resized to a maximum edge of 2400 pixels and converted to JPEG at 90% quality before embedding. This helps keep PDFs manageable, but does not preserve transparency or original image bytes.
- Very large batches can use substantial phone memory. For best results, convert in smaller groups (for example, 10–20 images).
- The app does not send selected image files to a server. Vercel only hosts the website's static app files.
- This is a web app/PWA, not a native Android APK.
- Use HTTPS hosting for installability and service-worker support.
