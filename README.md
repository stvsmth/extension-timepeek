# Timepeek extension

Quickly view a Unix timestamp in a human-readable format.

## Firefox Addon

https://addons.mozilla.org/en-US/firefox/addon/timepeek/

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
