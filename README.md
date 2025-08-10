# Timepeek extension

## Overview

Timepeek is a browser extension (currently focused on Firefox) that will display a formatted date if the
user selects a Unix timestamp in a web page. If the selected text is all digits, we treat that text
as a timestamp and convert it into a human readable data. The user can control how that date is
formatted as well as what timezone(s) to display.

## Firefox Addon

### Development for Firefox

The `web-ext` packages helps tremendously with extension development. You can install it using npm:

```bash
npm install --global web-ext
```

You can then test the extension in Firefox by running:

```bash
web-ext run
```

### Building for Firefox
```bash
web-ext build
```

Generate an API key via [Mozilla's Developer Hub](https://addons.mozilla.org/en-US/developers/addon/api/key/)

Once you have the API key, you can sign the extension using:

```bash
web-ext sign --api-key=user:42 --api-secret=abcdef0123456789 --channel=unlisted
```

## Chrome extension

Coming soon!
