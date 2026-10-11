(() => {
  "use strict";

  const BLUE = "#1685ff";
  const BG = "#f1efe9";
  const FG = "#111111";
  const MUTED = "#77736c";
  const LINE = "#d6d2ca";
  const SITE_URL = "https://murtburnerlab.github.io/five/";

  function fitText(ctx, text, maxWidth, startSize, minSize, weight = 800) {
    let size = startSize;
    do {
      ctx.font = `${weight} ${size}px Arial, Helvetica, sans-serif`;
      if (ctx.measureText(text).width <= maxWidth) return size;
      size -= 2;
    } while (size >= minSize);
    ctx.font = `${weight} ${minSize}px Arial, Helvetica, sans-serif`;
    return minSize;
  }

  function wrap(ctx, text, maxWidth) {
    const words = String(text || "").split(/\s+/).filter(Boolean);
    const lines = [];
    let line = "";
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (ctx.measureText(candidate).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    }
    if (line) lines.push(line);
    return lines;
  }

  async function shareRank(artist) {
    const canvas = document.createElement("canvas");
    canvas.width = 1080;
    canvas.height = 1920;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas unavailable");

    // Background and graphic frame
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, 1080, 1920);
    ctx.fillStyle = BLUE;
    ctx.fillRect(830, 0, 250, 18);
    ctx.fillRect(72, 118, 112, 10);
    ctx.fillRect(72, 900, 700, 22);
    ctx.fillRect(930, 1850, 78, 10);

    // Brand header — one glyph at a time; only V is blue.
    ctx.font = "800 64px Arial, Helvetica, sans-serif";
    let logoX = 72;
    for (const glyph of ["F", "I", "V", "E"]) {
      ctx.fillStyle = glyph === "V" ? BLUE : FG;
      ctx.fillText(glyph, logoX, 218);
      logoX += ctx.measureText(glyph).width;
    }
    ctx.font = "700 22px Arial, Helvetica, sans-serif";
    ctx.fillStyle = MUTED;
    ctx.textAlign = "right";
    ctx.fillText("GLOBAL ARTIST RANKING", 1008, 205);
    ctx.textAlign = "left";
    ctx.strokeStyle = FG;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(72, 270);
    ctx.lineTo(1008, 270);
    ctx.stroke();

    // Ranking statement
    ctx.fillStyle = MUTED;
    ctx.font = "700 26px Arial, Helvetica, sans-serif";
    ctx.fillText("CURRENT RANK", 72, 355);

    ctx.fillStyle = FG;
    const rankText = `#${artist.rank}`;
    fitText(ctx, rankText, 820, 220, 120, 800);
    ctx.fillText(rankText, 66, 650);

    // Artist name; wrap at the actual headline size.
    let nameSize = 82;
    let nameLines = [];
    while (nameSize >= 52) {
      ctx.font = `800 ${nameSize}px Arial, Helvetica, sans-serif`;
      nameLines = wrap(ctx, artist.name, 820);
      if (nameLines.every(line => ctx.measureText(line).width <= 820) && nameLines.length <= 2) break;
      nameSize -= 4;
    }
    ctx.font = `800 ${nameSize}px Arial, Helvetica, sans-serif`;
    ctx.fillStyle = FG;
    let y = 1040;
    for (const line of nameLines.slice(0, 2)) {
      ctx.fillText(line, 72, y);
      y += nameSize + 12;
    }

    ctx.fillStyle = MUTED;
    ctx.font = "400 34px Arial, Helvetica, sans-serif";
    ctx.fillText(artist.country || "Country not listed", 74, y + 22);

    ctx.fillStyle = FG;
    ctx.font = "800 38px Arial, Helvetica, sans-serif";
    ctx.fillText(`${artist.choices} ${Number(artist.choices) === 1 ? "CHOICE" : "CHOICES"}`, 72, y + 118);

    // Current-at-sharing qualification
    ctx.fillStyle = MUTED;
    ctx.font = "400 25px Arial, Helvetica, sans-serif";
    ctx.fillText("Rank based on real choices recorded on FIVE.", 72, 1450);

    // Footer block
    ctx.strokeStyle = FG;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(72, 1570);
    ctx.lineTo(1008, 1570);
    ctx.stroke();
    ctx.fillStyle = FG;
    ctx.fillRect(72, 1610, 936, 170);
    ctx.fillStyle = "#ffffff";
    ctx.font = "800 52px Arial, Helvetica, sans-serif";
    let footerLogoX = 108;
    for (const glyph of ["F", "I", "V", "E"]) {
      ctx.fillStyle = glyph === "V" ? BLUE : "#ffffff";
      ctx.fillText(glyph, footerLogoX, 1740);
      footerLogoX += ctx.measureText(glyph).width;
    }
    ctx.fillStyle = "#b9b6af";
    ctx.font = "400 20px Arial, Helvetica, sans-serif";
    ctx.fillText("murtburnerlab.github.io/five", 72, 1840);
    ctx.fillStyle = MUTED;
    ctx.textAlign = "right";
    ctx.font = "700 18px Arial, Helvetica, sans-serif";
    ctx.fillText("RANK AT TIME OF SHARING", 1008, 1880);
    ctx.textAlign = "left";

    const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/png"));
    if (!blob) throw new Error("Could not create the Story image.");
    const file = new File([blob], `five-rank-${artist.rank}.png`, { type: "image/png" });

    if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
      await navigator.share({
        files: [file],
        title: `${artist.name} — FIVE Rank #${artist.rank}`,
        text: `${artist.name} is currently ranked #${artist.rank} on FIVE. ${SITE_URL}`
      });
    } else {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `five-rank-${artist.rank}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      alert("Story image saved. Upload it to Instagram Stories.");
    }
  }

  function attachButtons() {
    const rows = document.querySelectorAll("#rankingResults .rank-row");
    if (!rows.length) return;
    const allRows = window.fiveRankingRows || [];
    const query = String(document.querySelector("#rankingSearch")?.value || "").trim().toLowerCase();
    const filtered = allRows.filter(r => String(r.name || "").toLowerCase().includes(query));
    const pageText = document.querySelector("#rankingPagination span")?.textContent || "";
    const match = pageText.match(/Showing\s+(\d+)[–-](\d+)/);
    const firstIndex = match ? Number(match[1]) - 1 : 0;

    rows.forEach((row, i) => {
      if (row.querySelector(".five-share-rank")) return;
      const rankNum = row.querySelector(".rank-num");
      const rank = Number(String(rankNum?.textContent || "").replace(/[^\d]/g, ""));
      const name = row.querySelector(".rank-artist")?.textContent?.trim();
      const country = row.querySelector(".rank-country")?.textContent?.trim() || "";
      const choiceText = row.querySelector(".rank-choice")?.textContent || "";
      const choicesMatch = choiceText.match(/(\d+)\s+choices?/i);
      const dataMatch = filtered.find(r => Number(r.rank) === rank && String(r.name || "").trim() === name);
      const choices = dataMatch ? Number(dataMatch.choices || 0) : (choicesMatch ? Number(choicesMatch[1]) : 0);
      if (!name || !Number.isFinite(rank) || rank < 1) return;

      const button = document.createElement("button");
      button.type = "button";
      button.className = "five-share-rank";
      button.textContent = "SHARE RANK";
      button.setAttribute("aria-label", `Share ${name}'s current FIVE rank, number ${rank}`);
      button.style.cssText = "grid-column:2/-1;justify-self:start;margin-top:4px;border:1px solid #1685ff;background:transparent;color:#1685ff;padding:10px 13px;font-size:10px;letter-spacing:.1em;font-weight:700";
      button.addEventListener("click", async () => {
        button.disabled = true;
        const oldText = button.textContent;
        button.textContent = "CREATING STORY…";
        try {
          await shareRank({ rank, name, country, choices });
        } catch (error) {
          if (error?.name !== "AbortError") alert("Could not share the rank card. Please try again.");
        } finally {
          button.disabled = false;
          button.textContent = oldText;
        }
      });
      row.appendChild(button);
    });
  }

  const observer = new MutationObserver(attachButtons);
  function start() {
    const root = document.getElementById("rankList");
    if (root) observer.observe(root, { childList: true, subtree: true });
    attachButtons();
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
  window.addEventListener("pageshow", attachButtons);
})();
