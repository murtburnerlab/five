/* FIVE story sharing — explicit, isolated routes. */
(() => {
  "use strict";
  const W = 1080, H = 1920;
  const C = { paper:"#f1efe9", ink:"#111111", muted:"#77736c", blue:"#1685ff", soft:"#d6d2ca", white:"#f7f6f2" };
  const milestones = [
    {count:10,title:"YOUR EYE"},{count:25,title:"EXPLORER SIGNAL"},{count:50,title:"TASTE PROFILE"},
    {count:100,title:"FIVE INSIDER"},{count:250,title:"COLLECTOR LEVEL"},{count:500,title:"FIVE ICON"},
    {count:1000,title:"TASTE AUTHORITY"},{count:3000,title:"CULTURE SHAPER"},{count:5000,title:"FIVE LEGEND"}
  ];
  const safe = (v, fallback="") => String(v ?? fallback).trim();
  const upper = v => safe(v).toLocaleUpperCase("en-US");

  function wordmark(ctx,x,y,size,foreground){
    ctx.font=`900 ${size}px Arial, Helvetica, sans-serif`;
    ctx.textBaseline="alphabetic";
    let cursor=x;
    for(const glyph of ["F","I","V","E"]){
      ctx.fillStyle=(glyph==="I"||glyph==="V")?C.blue:foreground;
      ctx.fillText(glyph,cursor,y);
      cursor+=ctx.measureText(glyph).width;
    }
  }
  function wrap(ctx, text, maxWidth, maxLines=3) {
    const words = safe(text).split(/\s+/).filter(Boolean), lines=[];
    let line="", used=0;
    for (const word of words) {
      const next=line ? `${line} ${word}` : word;
      if (ctx.measureText(next).width>maxWidth && line) {
        lines.push(line); line=word;
        if (lines.length >= maxLines) { used=1; break; }
      } else line=next;
    }
    if (line && lines.length<maxLines) lines.push(line);
    if (used && lines.length) {
      let last=lines[lines.length-1];
      while(last && ctx.measureText(last+"…").width>maxWidth) last=last.slice(0,-1);
      lines[lines.length-1]=last.trim()+"…";
    }
    return lines;
  }
  function base(ctx, label, kind) {
    ctx.fillStyle=C.paper; ctx.fillRect(0,0,W,H);
    ctx.fillStyle=C.blue; ctx.fillRect(830,0,250,18); ctx.fillRect(72,82,112,12);
    ctx.strokeStyle=C.ink; ctx.lineWidth=2;
    ctx.beginPath(); ctx.moveTo(72,230); ctx.lineTo(1008,230); ctx.moveTo(72,1570); ctx.lineTo(1008,1570); ctx.stroke();
    wordmark(ctx,72,184,60,C.ink);
    ctx.fillStyle=C.muted; ctx.font="700 22px Arial, Helvetica, sans-serif"; ctx.textAlign="right";
    ctx.fillText("GLOBAL ARTIST DISCOVERY",1008,176); ctx.textAlign="left";
    ctx.font="700 25px Arial, Helvetica, sans-serif"; ctx.fillText(upper(label),72,306);
    ctx.fillStyle=C.ink; ctx.fillRect(72,350,kind==="artist"?190:kind==="achievement"?250:160,8);
  }
  function footer(ctx) {
    ctx.fillStyle=C.ink; ctx.fillRect(72,1630,936,190);
    ctx.fillStyle=C.white; ctx.font="700 26px Arial, Helvetica, sans-serif"; ctx.fillText("DISCOVER. CHOOSE. RANK.",108,1698);
    wordmark(ctx,108,1780,45,C.white);
    ctx.fillStyle="#b9b5ad"; ctx.font="400 21px Arial, Helvetica, sans-serif"; ctx.fillText("fourfive.art",72,1874);
    ctx.fillStyle=C.blue; ctx.fillRect(930,1855,78,12);
  }
  function artistCard(ctx, name, count) {
    ctx.fillStyle=C.blue; ctx.fillRect(72,420,20,690);
    ctx.fillStyle=C.ink; ctx.font="700 25px Arial, Helvetica, sans-serif"; ctx.fillText("THE ARTIST I CHOOSE MOST",126,455);
    let size=112, lines=[];
    while(size>=54) {
      ctx.font=`900 ${size}px Arial, Helvetica, sans-serif`; lines=wrap(ctx,upper(name),790,3);
      if(lines.every(line=>ctx.measureText(line).width<=790)) break;
      size-=4;
    }
    ctx.font=`900 ${size}px Arial, Helvetica, sans-serif`; ctx.fillStyle=C.ink;
    let y=620; lines.forEach(line=>{ctx.fillText(line,126,y);y+=size*1.06;});
    const lineY=Math.min(1120,y+20);
    ctx.fillStyle=C.blue;ctx.fillRect(126,lineY,730,5);
    ctx.fillStyle=C.ink;ctx.font="900 34px Arial, Helvetica, sans-serif";ctx.fillText("MY TOP ARTIST",126,lineY+76);
    ctx.fillStyle=C.muted;ctx.font="700 25px Arial, Helvetica, sans-serif";
    ctx.fillText(`${count} ${count===1?"CALL":"CALLS"} RECORDED`,126,lineY+126);
    ctx.fillStyle=C.blue;ctx.beginPath();ctx.arc(880,1370,78,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle=C.ink;ctx.lineWidth=3;ctx.beginPath();ctx.arc(880,1370,116,0,Math.PI*2);ctx.stroke();
  }
  function callsCard(ctx,total) {
    ctx.fillStyle=C.ink;ctx.font="900 28px Arial, Helvetica, sans-serif";ctx.fillText("CHOICES MADE",72,450);
    const num=Number(total)||0;ctx.font="900 330px Arial, Helvetica, sans-serif";
    while(ctx.measureText(num.toLocaleString("en-US")).width>900 && parseInt(ctx.font,10)>150) ctx.font=`900 ${parseInt(ctx.font,10)-10}px Arial, Helvetica, sans-serif`;
    ctx.fillText(num.toLocaleString("en-US"),62,820);
    ctx.fillStyle=C.blue;ctx.fillRect(72,895,620,22);
    ctx.fillStyle=C.ink;ctx.font="900 64px Arial, Helvetica, sans-serif";ctx.fillText(num===1?"ONE CALL.":"REAL CHOICES.",72,1035);
    ctx.fillStyle=C.muted;ctx.font="400 32px Arial, Helvetica, sans-serif";
    wrap(ctx,"Every choice adds to my personal record of discovering artists on FIVE.",850,3).forEach((l,i)=>ctx.fillText(l,72,1110+i*48));
    ctx.fillStyle=C.soft;ctx.fillRect(72,1370,936,16);ctx.fillStyle=C.blue;ctx.fillRect(72,1370,Math.max(12,Math.min(936,num/5000*936)),16);
    ctx.fillStyle=C.muted;ctx.font="700 20px Arial, Helvetica, sans-serif";ctx.fillText("MY DISCOVERY HISTORY",72,1428);
  }
  function achievementCard(ctx,title,count,detail) {
    ctx.fillStyle=C.ink;ctx.font="700 26px Arial, Helvetica, sans-serif";ctx.fillText("MILESTONE / MY PROGRESS",72,450);
    let number=String(count), size=300;ctx.font=`900 ${size}px Arial, Helvetica, sans-serif`;
    while(ctx.measureText(number).width>900 && size>150){size-=10;ctx.font=`900 ${size}px Arial, Helvetica, sans-serif`;}
    ctx.fillText(number,62,820);
    ctx.fillStyle=C.blue;ctx.fillRect(72,895,936,22);
    let titleSize=82, lines=[];
    while(titleSize>48){ctx.font=`900 ${titleSize}px Arial, Helvetica, sans-serif`;lines=wrap(ctx,upper(title),900,3);if(lines.every(l=>ctx.measureText(l).width<=900))break;titleSize-=4;}
    ctx.fillStyle=C.ink;ctx.font=`900 ${titleSize}px Arial, Helvetica, sans-serif`;lines.forEach((l,i)=>ctx.fillText(l,72,1035+i*titleSize*1.05));
    ctx.fillStyle=C.muted;ctx.font="400 29px Arial, Helvetica, sans-serif";wrap(ctx,detail,820,3).forEach((l,i)=>ctx.fillText(l,72,1260+i*43));
    ctx.fillStyle=C.blue;ctx.fillRect(850,1390,158,18);ctx.fillRect(910,1420,98,18);ctx.fillRect(970,1450,38,18);
  }
  async function renderAndShare(data) {
    const canvas=document.createElement("canvas");canvas.width=W;canvas.height=H;
    const ctx=canvas.getContext("2d");if(!ctx)throw new Error("Canvas unavailable");
    base(ctx,data.label,data.type);
    if(data.type==="artist") artistCard(ctx,data.name,data.count);
    else if(data.type==="achievement") achievementCard(ctx,data.title,data.count,data.detail);
    else callsCard(ctx,data.total);
    footer(ctx);
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,"image/png"));
    if(!blob)throw new Error("Could not create image");
    const file=new File([blob],`five-${data.type}.png`,{type:"image/png"});
    if(navigator.share && (!navigator.canShare || navigator.canShare({files:[file]}))) {
      await navigator.share({files:[file],title:data.shareTitle||"FIVE",text:data.shareText||"Discover. Choose. Rank. https://fourfive.art/"});
    } else {
      const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=`five-${data.type}.png`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);
      alert("Story image saved. Upload it to Instagram Stories.");
    }
  }
  function totalCalls() {
    const el=document.getElementById("homeCalls");
    return Math.max(0,Number((el?.textContent||"0").replace(/[^\d]/g,""))||0);
  }
  function topArtist() {
    const item=document.querySelector("#fiveList .five-item");
    if(!item)return null;
    const name=item.querySelector("strong")?.textContent?.trim();
    const count=Math.max(0,Number((item.querySelector("span")?.textContent||"").replace(/[^\d]/g,""))||0);
    return name && count>0 ? {name,count}:null;
  }

  // Route 1: YOUR EYE button only.
  window.shareEye = async function() {
    const artist=topArtist();
    if(artist) return renderAndShare({type:"artist",label:"MY TOP ARTIST",name:artist.name,count:artist.count,shareTitle:"My top artist on FIVE",shareText:`${artist.name} — my most-chosen artist on FIVE`});
    return renderAndShare({type:"calls",label:"MY DISCOVERY",total:totalCalls(),shareTitle:"My FIVE discovery history",shareText:`${totalCalls()} real calls on FIVE`});
  };

  // YOUR EYE > SHARE MY STORY uses the same progress-card template/data as the former Account > SHARE MY LEVEL.
  window.shareMyStory = async function() {
    const total = totalCalls();
    const milestone = [...milestones].reverse().find(m => total >= m.count);
    const title = milestone?.title || "FIRST CALL";
    return renderAndShare({
      type: "achievement",
      label: "MY FIVE PROGRESS",
      title,
      count: total,
      detail: "My discovery history is growing on FIVE.",
      shareTitle: "My FIVE progress",
      shareText: `${total} real calls on FIVE`
    });
  };

  // Route 2: account progress and achievement buttons. These must never call shareEye.
  document.addEventListener("click", event=>{
    const achievementBtn=event.target.closest("#fiveAchievementShare");
    const progressBtn=event.target.closest("#fiveShareProgress");
    if(!achievementBtn&&!progressBtn)return;
    event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
    if(achievementBtn) {
      const title=document.getElementById("fiveAchievementTitle")?.textContent?.trim()||"ACHIEVEMENT";
      const mark=document.getElementById("fiveAchievementMark")?.textContent?.trim()||"0";
      const detail=document.getElementById("fiveAchievementCopy")?.textContent?.trim()||"My discovery history is growing on FIVE.";
      const milestone=[...milestones].reverse().find(m=>m.title===title);
      renderAndShare({type:"achievement",label:"FIVE ACHIEVEMENT",title,count:milestone?.count||Number(mark)||0,detail,shareTitle:"My FIVE achievement",shareText:`${title} — FIVE`});
    } else {
      const total=totalCalls(), milestone=[...milestones].reverse().find(m=>total>=m.count);
      renderAndShare({type:"achievement",label:"MY FIVE PROGRESS",title:milestone?.title||"FIRST CALL",count:total,detail:"My discovery history is growing on FIVE.",shareTitle:"My FIVE progress",shareText:`${total} real calls on FIVE`});
    }
  },true);
  window.FIVEStoryShare={
    shareCalls:total=>renderAndShare({type:"calls",label:"MY DISCOVERY",total:Number(total)||0}),
    shareArtist:(name,count)=>renderAndShare({type:"artist",label:"MY TOP ARTIST",name,count:Number(count)||0}),
    shareAchievement:(title,count,detail="")=>renderAndShare({type:"achievement",label:"FIVE ACHIEVEMENT",title,count:Number(count)||0,detail})
  };
})();