# Chrome Web Store Publishing Guide

## Initial Setup (One-time)

1. **Developer Account** - Register at [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
   - One-time $5 registration fee
   - Requires a Google account

2. **Prepare Extension Package**
   - Build your Chrome version (you already have the manifest V3 setup on the `chromify` branch)
   - Create a ZIP file of your extension directory
   - No signing required (unlike Firefox) - Google handles that

## Publishing Process

3. **Upload & Configure**
   - Upload your ZIP file to the developer dashboard
   - Fill out store listing:
     - Description, screenshots, promotional images
     - Category and language
     - Privacy policy (optional for most extensions, but recommended)

4. **Store Assets Required**
   - 128x128 icon (you have this)
   - At least 1 screenshot (1280x800 or 640x400)
   - Optional: promotional tile image (440x280)

5. **Privacy & Permissions**
   - Declare why you need each permission
   - If you collect data, privacy policy is mandatory
   - Your extension is simple (no data collection), so minimal requirements
