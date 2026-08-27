export default function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy({ "src/public": "/" });
  eleventyConfig.addPassthroughCopy({ "src/fonts": "/fonts" });
  eleventyConfig.addPassthroughCopy({ "src/js": "/js" });
  eleventyConfig.addFilter("readableDate", (d) =>
    new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" })
  );
  eleventyConfig.addFilter("isoDate", (d) => new Date(d).toISOString().split("T")[0]);
  const stripAccent = (s) => String(s).replace(/\*\*([^*]+)\*\*/g, "$1");
  eleventyConfig.addFilter("plainText", stripAccent);
  eleventyConfig.addFilter("accentize", (s) =>
    stripAccent(String(s)).length === String(s).length
      ? String(s)
      : String(s).replace(/\*\*([^*]+)\*\*/g, '<span class="hl">$1</span>')
  );
  eleventyConfig.addFilter("readingTime", (html) => {
    const words = String(html).replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.round(words / 200));
  });
  eleventyConfig.addTransform("asciiPunctuation", (content, pagePath) => {
    if (!pagePath || !pagePath.endsWith(".html")) return content;
    const M = {"\u2014":"&#8212;","\u2013":"&#8211;","\u2018":"&#8216;","\u2019":"&#8217;","\u201C":"&#8220;","\u201D":"&#8221;","\u2026":"&#8230;","\u2192":"&#8594;","\u2190":"&#8592;","\u2197":"&#8599;","\u00B7":"&#183;","\u00D7":"&#215;","\u2191":"&#8593;","\u2193":"&#8595;","\u21BA":"&#8634;","\u21BB":"&#8635;","\u00A9":"&#169;","\u00E9":"&#233;","\u00A0":"&#160;"};
    const stash = [];
    let out = content.replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, (m) => { stash.push(m); return "\u0000" + (stash.length - 1) + "\u0000"; });
    out = out.replace(/[\u2014\u2013\u2018\u2019\u201C\u201D\u2026\u2191\u2192\u2193\u2190\u2197\u21BA\u21BB\u00B7\u00D7\u00A9\u00E9\u00A0]/g, (c) => M[c] || c);
    out = out.replace(/\u0000(\d+)\u0000/g, (_, i) => stash[+i]);
    return out;
  });
  return {
    dir: { input: "src", includes: "_includes", data: "_data", output: "_site" },
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
  };
}
