function decodeGoogleNewsUrl(googleUrl: string) {
  const urlObj = new URL(googleUrl);
  const pathParts = urlObj.pathname.split('/');
  const encodedId = pathParts[pathParts.length - 1]; // e.g., CBMiV0FV...

  // Base64Url decode
  const base64 = encodedId.replace(/-/g, '+').replace(/_/g, '/');
  const buffer = Buffer.from(base64, 'base64');
  const decodedStr = buffer.toString('utf-8');
  console.log("Decoded raw:", decodedStr);
  
  // Find HTTP/HTTPS
  const match = decodedStr.match(/https?:\/\/[^\s\x00-\x1F]+/);
  if (match) {
    console.log("Found URL:", match[0]);
  } else {
    console.log("No URL found");
  }
}

decodeGoogleNewsUrl("https://news.google.com/rss/articles/CBMiV0FVX3lxTE1nbTBybzJ0dEJld3hQV3M5cGI2RllRWndWYjd6bl9hSkNxbXNzcUpvVTVrWnFYYmc2WHliRGJtVDRhclFGSVFWbFNCV1drNzJMaU5Qc1NBTQ?oc=5");
