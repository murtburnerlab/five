/* FIVE — unified Instagram Story share cards
   Load this file AFTER app.js and five-account-ui.js.
   It intercepts the existing share actions and renders branded 1080×1920 cards.
*/
(() => {
  "use strict";

  const W = 1080, H = 1920;
  const C = {
    paper: "#f1efe9",
    ink: "#111111",
    muted: "#77736c",
    blue: "#1685ff",
    soft: "#d6d2ca",
    white: "#f7f6f2"
  };

  const milestones = [
    { count: 10, title: "YOUR EYE" },
    { count: 25, title: "EXPLORER SIGNAL" },
    { count: 50, title: "TASTE PROFILE" },
    { count: 100, title: "FIVE INSIDER" },
    { count: 250, title: "COLLECTOR LEVEL" },
    { count: 500, title: "FIVE ICON" },
    { count: 1000, title: "TASTE AUTHORITY" },
    { count: 3000, title: "CULTURE SHAPER" },
    { count: 5000, title: "FIVE LEGEND" }
  ];

  const safe = (value, fallback = "") => String(value ?? fallback).trim();
  const upper = value => safe(value).toLocaleUpperCase();

  function roundedRect(ctx, x, y, w, h, r, fill) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    if (fill) ctx.fill();
  }

  function fitFont(ctx, text, maxWidth, start, min, weight = 900) {
    let size = start;
    while (size > min) {
      ctx.font = `${weight} ${size}px Arial, Helvetica, sans-serif`;
      if (ctx.measureText(text).width <= maxWidth) return size;
      size -= 2;
    }
    ctx.font = `${weight} ${min}px Arial, Helvetica, sans-serif`;
    return min;
  }

  function wrapText(ctx, text, maxWidth, maxLines = 3) {
    const words = safe(text).split(/\s+/).filter(Boolean);
    const lines = [];
    let line = "";
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = word;
        if (lines.length === maxLines) break;
      } else {
        line = test;
      }
    }
    if (line && lines.length < maxLines) lines.push(line);
    if (lines.length && words.length) {
      const rendered = lines.join(" ").split(/\s+/).length;
      if (rendered < words.length) {
        let last = lines[lines.length - 1];
        while (last.length && ctx.measureText(`${last}…`).width > maxWidth) {
          last = last.slice(0, -1);
        }
        lines[lines.length - 1] = `${last.trim()}…`;
      }
    }
    return lines;
  }

  function drawWordmark(ctx, x, y, scale = 1, color = C.ink) {
    ctx.textBaseline = "alphabetic";
    ctx.font = `900 ${70 * scale}px Arial, Helvetica, sans-serif`;
    ctx.fillStyle = color;
    ctx.fillText("FI", x, y);
    const fiWidth = ctx.measureText("FI").width;
    ctx.fillStyle = C.blue;
    ctx.fillText("V", x + fiWidth - 2 * scale, y);
    const vWidth = ctx.measureText("V").width;
    ctx.fillStyle = color;
    ctx.fillText("E", x + fiWidth + vWidth - 4 * scale, y);
  }

  function drawBase(ctx, label, type) {
    ctx.fillStyle = C.paper;
    ctx.fillRect(0, 0, W, H);

    // Large off-grid blue shape: a recurring graphic signature.
    ctx.fillStyle = C.blue;
    ctx.fillRect(830, 0, 250, 18);
    ctx.fillRect(1000, 0, 80, 330);
    ctx.fillRect(72, 82, 112, 12);

    // Small registration marks and frame.
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(72, 230); ctx.lineTo(1008, 230);
    ctx.moveTo(72, 1570); ctx.lineTo(1008, 1570);
    ctx.stroke();

    drawWordmark(ctx, 72, 184, 0.86);
    ctx.fillStyle = C.muted;
    ctx.font = "700 22px Arial, Helvetica, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText("GLOBAL ARTIST DISCOVERY", 1008, 176);
    ctx.textAlign = "left";

    ctx.fillStyle = C.muted;
    ctx.font = "700 24px Arial, Helvetica, sans-serif";
    ctx.fillText(upper(label), 72, 306);

    // Distinct small type tag, deliberately graphic rather than UI-like.
    ctx.fillStyle = C.ink;
    ctx.fillRect(72, 350, type === "artist" ? 190 : type === "achievement" ? 250 : 160, 8);
  }

  function drawFooter(ctx) {
    ctx.fillStyle = C.ink;
    ctx.fillRect(72, 1630, 936, 190);
    ctx.fillStyle = C.white;
    ctx.font = "700 26px Arial, Helvetica, sans-serif";
    ctx.fillText("DISCOVER. CHOOSE. RANK.", 108, 1698);
    drawWordmark(ctx, 108, 1780, 0.64, C.white);
    ctx.fillStyle = "#b9b5ad";
    ctx.font = "400 21px Arial, Helvetica, sans-serif";
    ctx.fillText("murtburnerlab.github.io/five", 72, 1874);
    ctx.fillStyle = C.blue;
    ctx.fillRect(930, 1855, 78, 12);
  }

  function drawCalls(ctx, data) {
    const total = Math.max(0, Number(data.total) || 0);
    ctx.fillStyle = C.ink;
    ctx.font = "900 28px Arial, Helvetica, sans-serif";
    ctx.fillText("CHOICES MADE", 72, 450);

    // Huge number is the visual anchor.
    const number = total.toLocaleString("en-US");
    fitFont(ctx, number, 900, 330, 170);
    ctx.fillStyle = C.ink;
    ctx.fillText(number, 52, 820);

    ctx.fillStyle = C.blue;
    ctx.fillRect(72, 895, 620, 22);
    ctx.fillStyle = C.ink;
    ctx.font = "900 64px Arial, Helvetica, sans-serif";
    ctx.fillText(total === 1 ? "ONE CALL." : "REAL CHOICES.", 72, 1035);

    ctx.fillStyle = C.muted;
    ctx.font = "400 32px Arial, Helvetica, sans-serif";
    const lines = wrapText(ctx, "Every choice adds to my personal record of discovering artists on FIVE.", 790, 3);
    lines.forEach((line, i) => ctx.fillText(line, 72, 1110 + i * 48));

    // Graphic index bar scales with progress, capped for visual balance.
    ctx.fillStyle = C.soft;
    ctx.fillRect(72, 1370, 936, 16);
    ctx.fillStyle = C.blue;
    ctx.fillRect(72, 1370, Math.max(12, Math.min(936, (total / 5000) * 936)), 16);
    ctx.fillStyle = C.muted;
    ctx.font = "700 20px Arial, Helvetica, sans-serif";
    ctx.fillText("MY DISCOVERY HISTORY", 72, 1428);
    ctx.textAlign = "right";
    ctx.fillText("FIVE", 1008, 1428);
    ctx.textAlign = "left";
  }

  function drawArtist(ctx, data) {
    const name = safe(data.title, "MY TOP ARTIST");
    ctx.fillStyle = C.blue;
    ctx.fillRect(72, 420, 20, 730);

    ctx.save();
    ctx.translate(132, 0);
    ctx.fillStyle = C.ink;
    ctx.font = "700 25px Arial, Helvetica, sans-serif";
    ctx.fillText("THE ARTIST I CHOOSE MOST", 0, 455);

    const words = wrapText(ctx, upper(name), 790, 4);
    let size = 116;
    while (size > 66) {
      ctx.font = `900 ${size}px Arial, Helvetica, sans-serif`;
      if (words.every(line => ctx.measureText(line).width <= 790)) break;
      size -= 4;
    }
    ctx.font = `900 ${size}px Arial, Helvetica, sans-serif`;
    words.forEach((line, i) => ctx.fillText(line, 0, 620 + i * (size * 1.03)));

    const y = Math.min(1120, 660 + words.length * (size * 1.03));
    ctx.fillStyle = C.blue;
    ctx.fillRect(0, y, 730, 5);
    ctx.fillStyle = C.ink;
    ctx.font = "900 34px Arial, Helvetica, sans-serif";
    ctx.fillText("MY TOP ARTIST", 0, y + 78);

    const count = Math.max(0, Number(data.artistCount) || 0);
    ctx.fillStyle = C.muted;
    ctx.font = "700 25px Arial, Helvetica, sans-serif";
    ctx.fillText(`${count} ${count === 1 ? "CALL" : "CALLS"} RECORDED`, 0, y + 128);
    ctx.restore();

    // Abstract poster motif.
    ctx.fillStyle = C.blue;
    ctx.beginPath();
    ctx.arc(880, 1320, 92, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = C.ink;
    ctx.fillRect(720, 1260, 90, 90);
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(880, 1320, 132, 0, Math.PI * 2);
    ctx.stroke();
  }

  function drawAchievement(ctx, data) {
    const count = Math.max(0, Number(data.count) || 0);
    const title = safe(data.title, "FIRST CALL");
    ctx.fillStyle = C.ink;
    ctx.font = "700 26px Arial, Helvetica, sans-serif";
    ctx.fillText("MILESTONE UNLOCKED", 72, 455);

    fitFont(ctx, String(count).padStart(count < 100 ? 2 : 1, "0"), 880, 330, 170);
    ctx.fillStyle = C.ink;
    ctx.fillText(String(count).padStart(count < 100 ? 2 : 1, "0"), 62, 835);

    ctx.fillStyle = C.blue;
    ctx.fillRect(72, 900, 936, 22);
    ctx.fillStyle = C.ink;
    const lines = wrapText(ctx, upper(title), 900, 3);
    let size = 88;
    while (size > 48) {
      ctx.font = `900 ${size}px Arial, Helvetica, sans-serif`;
      if (lines.every(line => ctx.measureText(line).width <= 900)) break;
      size -= 4;
    }
    ctx.font = `900 ${size}px Arial, Helvetica, sans-serif`;
    lines.forEach((line, i) => ctx.fillText(line, 72, 1035 + i * size * 1.05));

    ctx.fillStyle = C.muted;
    ctx.font = "400 29px Arial, Helvetica, sans-serif";
    const detailLines = wrapText(ctx, safe(data.detail, "My discovery history is growing on FIVE."), 820, 3);
    detailLines.forEach((line, i) => ctx.fillText(line, 72, 1260 + i * 43));

    // Abstract stepped marker.
    ctx.fillStyle = C.blue;
    ctx.fillRect(850, 1350, 158, 18);
    ctx.fillRect(910, 1380, 98, 18);
    ctx.fillRect(970, 1410, 38, 18);
  }

  function render(data) {
    const canvas = document.createElement("canvas");
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas is unavailable.");

    drawBase(ctx, data.label || "MY FIVE STORY", data.type || "calls");
    if (data.type === "artist") drawArtist(ctx, data);
    else if (data.type === "achievement") drawAchievement(ctx, data);
    else drawCalls(ctx, data);
    drawFooter(ctx);
    return new Promise((resolve, reject) => {
      canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("Could not create the story image.")), "image/png");
    });
  }

  async function share(data) {
    try {
      const blob = await render(data);
      const file = new File([blob], "five-story.png", { type: "image/png" });
      if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
        await navigator.share({
          files: [file],
          title: safe(data.shareTitle, "My FIVE Story"),
          text: safe(data.shareText, "Discover. Choose. Rank.")
        });
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "five-story.png";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
      announce("Story image saved. Upload it to Instagram Stories.", true);
    } catch (error) {
      if (error?.name === "AbortError") return;
      console.error("FIVE story share failed:", error);
      announce("Could not create or share the story image. Please try again.", false);
    }
  }

  function announce(message, success) {
    const el = document.getElementById("fiveAccountMessage") ||
      document.getElementById("authMessage") ||
      document.getElementById("callsMessage");
    if (el) {
      el.textContent = message;
      el.classList.remove("hidden");
      el.classList.toggle("success", !!success);
      el.style.display = "block";
    } else {
      window.alert(message);
    }
  }

  function getCallCount() {
    const value = document.getElementById("homeCalls")?.textContent || "0";
    return Math.max(0, Number(value.replace(/[^\d]/g, "")) || 0);
  }

  function topArtistData() {
    // app.js keeps its call history in a lexical variable, not window.myCalls.
    // The shareEye action lives on YOUR EYE, where this list is rendered from that history.
    const first = document.querySelector("#fiveList .five-item");
    if (first) {
      const name = first.querySelector("strong")?.textContent?.trim() || "Artist";
      const countText = first.querySelector("span")?.textContent || "0";
      const count = Math.max(0, Number(countText.replace(/[^\\d]/g, "")) || 0);
      if (count > 0) return { name, count };
    }
    const bestName = document.getElementById("bestCall")?.textContent?.trim();
    const bestCopy = document.getElementById("bestCallCopy")?.textContent || "";
    const match = bestCopy.match(/(\\d+) recorded call/);
    if (bestName && bestName !== "—" && match) {
      return { name: bestName, count: Number(match[1]) || 0 };
    }
    return null;
  }

  // The original app.js exposes shareEye on window. Replace only that action.
  window.shareEye = async function () {
    const artist = topArtistData();
    const total = getCallCount();
    if (artist) {
      await share({
        type: "artist",
        label: "MY TOP ARTIST",
        title: artist.name,
        artistCount: artist.count,
        shareTitle: "My top artist on FIVE",
        shareText: `${artist.name} — my most-chosen artist on FIVE`
      });
    } else {
      await share({
        type: "calls",
        label: "MY DISCOVERY",
        total,
        shareTitle: "My FIVE discovery history",
        shareText: `${total} real calls on FIVE`
      });
    }
  };

  // Capture phase ensures the old account-ui.js canvas listeners don't run too.
  document.addEventListener("click", event => {
    const achievementButton = event.target.closest("#fiveAchievementShare");
    const progressButton = event.target.closest("#fiveShareProgress");
    if (!achievementButton && !progressButton) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    if (achievementButton) {
      const title = document.getElementById("fiveAchievementTitle")?.textContent || "ACHIEVEMENT";
      const mark = document.getElementById("fiveAchievementMark")?.textContent || "0";
      const detail = document.getElementById("fiveAchievementCopy")?.textContent || "";
      const milestone = [...milestones].reverse().find(item => item.title === title);
      share({
        type: "achievement",
        label: "FIVE ACHIEVEMENT",
        title,
        count: milestone?.count || Number(mark) || 0,
        detail,
        shareTitle: "My FIVE achievement",
        shareText: `${title} — FIVE`
      });
      return;
    }

    const total = getCallCount();
    const milestone = [...milestones].reverse().find(item => total >= item.count);
    share({
      type: "achievement",
      label: "MY FIVE PROGRESS",
      title: milestone?.title || "FIRST CALL",
      count: milestone?.count || total,
      detail: "My discovery history is growing on FIVE.",
      shareTitle: "My FIVE progress",
      shareText: `${total} real calls on FIVE`
    });
  }, true);

  // Optional explicit API for future share buttons without adding another renderer.
  window.FIVEStoryShare = {
    shareCalls: total => share({ type: "calls", label: "MY DISCOVERY", total }),
    shareArtist: (title, artistCount) => share({ type: "artist", label: "MY TOP ARTIST", title, artistCount }),
    shareAchievement: (title, count, detail = "") => share({ type: "achievement", label: "FIVE ACHIEVEMENT", title, count, detail })
  };
})();
