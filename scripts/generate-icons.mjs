import sharp from "sharp";

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop stop-color="#101828"/>
      <stop offset="1" stop-color="#0B1220"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="112" fill="url(#g)"/>
  <path d="M156 180h200c14 0 24 12 22 26l-28 196c-2 14-14 24-28 24H190c-14 0-26-10-28-24l-28-196c-2-14 8-26 22-26z" fill="none" stroke="#C8F542" stroke-width="28" stroke-linejoin="round"/>
  <path d="M196 180c0-40 24-68 60-68s60 28 60 68" fill="none" stroke="#5EEAD4" stroke-width="28" stroke-linecap="round"/>
  <circle cx="256" cy="290" r="18" fill="#C8F542"/>
</svg>`;

const buf = Buffer.from(svg);

await Promise.all([
  sharp(buf).png().toFile("public/icon-512.png"),
  sharp(buf).resize(192, 192).png().toFile("public/icon-192.png"),
  sharp(buf).resize(180, 180).png().toFile("public/apple-touch-icon.png"),
]);

console.log("icons ok");
