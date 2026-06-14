const fs = require("fs");
const path = require("path");

const data = JSON.parse(fs.readFileSync("technologies.json", "utf8"));

function generateRootIndex(d) {
  const stats = d.heroStats.map(s => `
    <div class="hero-stat"><div class="num">${s.num}</div><div class="label">${s.label}</div></div>
  `).join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${d.project.name} — ${d.project.tagline}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{background:#030712;color:#F1F5F9;font-family:system-ui,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;text-align:center;padding:2rem}
  h1{font-size:clamp(1.5rem,5vw,3rem);background:linear-gradient(135deg,#00F5FF,#7B61FF,#FF4FD8);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:1rem}
  p{color:#94A3B8;margin-bottom:2rem;max-width:500px}
  .stats{display:flex;gap:1.5rem;flex-wrap:wrap;justify-content:center;margin-bottom:2rem}
  .stat{text-align:center}
  .stat .num{font-size:1.5rem;font-weight:700;background:linear-gradient(135deg,#00F5FF,#7B61FF);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
  .stat .label{font-size:0.75rem;color:#64748B}
  a{display:inline-block;padding:0.75rem 2rem;background:linear-gradient(135deg,#7B61FF,#FF4FD8);color:#fff;border-radius:8px;text-decoration:none;font-weight:600;transition:transform 0.3s}
  a:hover{transform:translateY(-2px)}
</style>
</head>
<body>
  <h1>◈ ${d.project.name}</h1>
  <p>${d.project.tagline} — Interactive Learning Hub</p>
  <div class="stats">${stats}</div>
  <a href="/Final-Sem-Project/viva-web3connect/">🚀 Enter Learning Hub</a>
</body>
</html>`;
}

function generateVivaIndex(d) {
  const nodesJSON = JSON.stringify(d.nodes, null, 1);
  const flowStepsJSON = JSON.stringify(d.flowSteps, null, 1);
  const techStackJSON = JSON.stringify(d.techStack, null, 1);
  const treeDataJSON = JSON.stringify(d.treeData, null, 1);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${d.project.name} — Full Stack Blockchain Learning Hub</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=Orbitron:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --bg-primary:#030712;--bg-secondary:#07111F;--bg-card:rgba(15,20,35,0.7);
  --neon-cyan:#00F5FF;--neon-purple:#7B61FF;--neon-pink:#FF4FD8;
  --neon-green:#00FFA3;--neon-yellow:#FFD166;--neon-red:#FF4D6D;--neon-blue:#3B82F6;
  --text-primary:#F1F5F9;--text-secondary:#94A3B8;--text-muted:#64748B;
  --glass-border:rgba(123,97,255,0.15);--glass-bg:rgba(15,20,35,0.7);
  --font-display:'Orbitron',monospace;--font-body:'Inter',system-ui,sans-serif;
  --font-mono:'JetBrains Mono',monospace;
  --radius:16px;--radius-sm:8px;--radius-lg:24px;
  --shadow-glow:0 0 40px rgba(123,97,255,0.3);
}
html{scroll-behavior:smooth}
body{font-family:var(--font-body);background:var(--bg-primary);color:var(--text-primary);line-height:1.7;overflow-x:hidden;min-height:100vh}
::-webkit-scrollbar{width:8px}
::-webkit-scrollbar-track{background:var(--bg-primary)}
::-webkit-scrollbar-thumb{background:linear-gradient(180deg,var(--neon-purple),var(--neon-cyan));border-radius:4px}
#particles-canvas{position:fixed;top:0;left:0;width:100%;height:100%;z-index:0;pointer-events:none}
nav{position:fixed;top:0;left:0;right:0;z-index:100;background:rgba(3,7,18,0.85);backdrop-filter:blur(20px);border-bottom:1px solid var(--glass-border);padding:0 2rem;height:64px;display:flex;align-items:center;justify-content:space-between}
.nav-logo{font-family:var(--font-display);font-size:1.25rem;background:linear-gradient(135deg,var(--neon-cyan),var(--neon-purple));-webkit-background-clip:text;-webkit-text-fill-color:transparent;font-weight:700}
.nav-links{display:flex;gap:1.5rem;align-items:center;flex-wrap:wrap}
.nav-links a{color:var(--text-secondary);text-decoration:none;font-size:0.875rem;transition:color 0.3s;cursor:pointer}
.nav-links a:hover{color:var(--neon-cyan)}
.viva-btn{background:linear-gradient(135deg,var(--neon-purple),var(--neon-pink));border:none;color:#fff;padding:0.5rem 1.25rem;border-radius:var(--radius-sm);font-family:var(--font-body);font-weight:600;font-size:0.875rem;cursor:pointer;transition:all 0.3s}
.viva-btn:hover{transform:translateY(-2px);box-shadow:0 0 30px rgba(123,97,255,0.5)}
.quiz-btn{background:linear-gradient(135deg,var(--neon-yellow),var(--neon-red));border:none;color:#fff;padding:0.5rem 1.25rem;border-radius:var(--radius-sm);font-family:var(--font-body);font-weight:600;font-size:0.875rem;cursor:pointer;transition:all 0.3s}
.quiz-btn:hover{transform:translateY(-2px);box-shadow:0 0 30px rgba(255,77,109,0.4)}
.mobile-toggle{display:none;background:none;border:none;color:var(--text-primary);font-size:1.5rem;cursor:pointer}
.hero{position:relative;z-index:1;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:6rem 2rem 4rem}
.hero-badge{display:inline-block;padding:0.4rem 1.2rem;border:1px solid var(--glass-border);border-radius:100px;font-size:0.8rem;color:var(--neon-cyan);margin-bottom:1.5rem;background:rgba(0,245,255,0.05)}
.hero h1{font-family:var(--font-display);font-size:clamp(2rem,6vw,4.5rem);background:linear-gradient(135deg,var(--neon-cyan),var(--neon-purple),var(--neon-pink));-webkit-background-clip:text;-webkit-text-fill-color:transparent;line-height:1.1;margin-bottom:1.5rem}
.hero p{font-size:clamp(1rem,2vw,1.25rem);color:var(--text-secondary);max-width:700px;margin-bottom:2.5rem}
.hero-stats{display:flex;gap:3rem;flex-wrap:wrap;justify-content:center}
.hero-stat{text-align:center}
.hero-stat .num{font-family:var(--font-display);font-size:2.5rem;background:linear-gradient(135deg,var(--neon-cyan),var(--neon-purple));-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.hero-stat .label{font-size:0.85rem;color:var(--text-muted);margin-top:0.25rem}
.section-title{text-align:center;margin-bottom:3rem;position:relative;z-index:1}
.section-title h2{font-family:var(--font-display);font-size:clamp(1.5rem,3vw,2.5rem);background:linear-gradient(135deg,var(--neon-cyan),var(--neon-purple));-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:0.75rem}
.section-title p{color:var(--text-secondary);max-width:600px;margin:0 auto}
#architecture{position:relative;z-index:1;padding:4rem 2rem;background:linear-gradient(180deg,transparent,var(--bg-secondary))}
.arch-canvas{max-width:1000px;margin:0 auto;position:relative;background:var(--bg-card);border:1px solid var(--glass-border);border-radius:var(--radius-lg);padding:2rem;overflow:hidden}
.arch-svg{width:100%;height:auto}
.arch-layer{transition:all 0.3s;cursor:pointer}
.arch-layer:hover{filter:brightness(1.3)}
.arch-arrow{animation:archFlow 2s ease-in-out infinite}
@keyframes archFlow{0%,100%{opacity:0.3}50%{opacity:1}}
.arch-arrow:nth-child(2){animation-delay:0.5s}
.arch-arrow:nth-child(3){animation-delay:1s}
.arch-tag{font-family:var(--font-mono);font-size:0.7rem;fill:var(--text-muted)}
#structure{position:relative;z-index:1;padding:4rem 2rem}
.structure-container{max-width:900px;margin:0 auto;background:var(--bg-card);border:1px solid var(--glass-border);border-radius:var(--radius-lg);padding:2rem;font-family:var(--font-mono);font-size:0.85rem;overflow-x:auto}
.tree-line{display:flex;align-items:center;padding:0.2rem 0;color:var(--text-secondary);transition:color 0.2s;cursor:default;white-space:nowrap}
.tree-line:hover{color:var(--text-primary)}
.tree-line .prefix{color:var(--text-muted);user-select:none;min-width:2ch}
.tree-line .icon{margin-right:0.5rem;font-size:0.9rem}
.tree-line .name{font-weight:500}
.tree-line .name.dir{color:var(--neon-cyan)}
.tree-line .name.file{color:var(--text-primary)}
.tree-line .name.link{color:var(--neon-purple)}
.tree-line .badge{font-size:0.65rem;margin-left:0.5rem;padding:0.1rem 0.4rem;border-radius:3px;background:rgba(123,97,255,0.15);color:var(--neon-purple)}
.tree-line .badge.green{background:rgba(0,255,163,0.15);color:var(--neon-green)}
.tree-line .badge.blue{background:rgba(59,130,246,0.15);color:var(--neon-blue)}
.tree-toggle{background:none;border:none;color:var(--text-muted);cursor:pointer;margin-right:0.25rem;font-size:0.7rem;width:1.2rem;text-align:center;transition:color 0.2s}
.tree-toggle:hover{color:var(--neon-cyan)}
.tree-children{padding-left:2rem}
.tree-children.hidden{display:none}
#roadmap{position:relative;z-index:1;padding:4rem 2rem;background:linear-gradient(180deg,transparent,var(--bg-secondary),transparent)}
.roadmap-container{max-width:1200px;margin:0 auto;position:relative}
.nodes-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:1rem;position:relative;z-index:1}
.node-card{background:var(--glass-bg);border:1px solid var(--glass-border);border-radius:var(--radius);padding:1.5rem;cursor:pointer;transition:all 0.4s cubic-bezier(0.4,0,0.2,1);position:relative;overflow:hidden;text-align:center;backdrop-filter:blur(10px)}
.node-card::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,var(--neon-cyan),var(--neon-purple));transform:scaleX(0);transform-origin:left;transition:transform 0.4s}
.node-card:hover::before{transform:scaleX(1)}
.node-card:hover{border-color:var(--neon-purple);transform:translateY(-4px);box-shadow:0 0 30px rgba(123,97,255,0.2)}
.node-card .icon{font-size:2rem;margin-bottom:0.75rem;display:flex;align-items:center;justify-content:center}
.node-card h3{font-size:1rem;font-weight:600;margin-bottom:0.5rem;background:linear-gradient(135deg,var(--neon-cyan),var(--neon-purple));-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.node-card p{font-size:0.8rem;color:var(--text-muted);line-height:1.4}
.panel-overlay{position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.7);z-index:200;opacity:0;pointer-events:none;transition:opacity 0.4s}
.panel-overlay.active{opacity:1;pointer-events:all}
.panel{position:fixed;top:0;right:0;width:min(90vw,600px);height:100%;background:var(--bg-primary);border-left:1px solid var(--glass-border);z-index:201;overflow-y:auto;padding:2rem;transform:translateX(100%);transition:transform 0.4s cubic-bezier(0.4,0,0.2,1)}
.panel.open{transform:translateX(0)}
.panel-close{position:absolute;top:1rem;right:1rem;background:none;border:none;color:var(--text-secondary);font-size:1.5rem;cursor:pointer;transition:color 0.3s}
.panel-close:hover{color:var(--neon-cyan)}
.panel h2{font-family:var(--font-display);font-size:1.5rem;background:linear-gradient(135deg,var(--neon-cyan),var(--neon-purple));-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:1.5rem;padding-right:2rem}
.panel-section{margin-bottom:2rem}
.panel-section h3{font-size:1rem;color:var(--neon-cyan);margin-bottom:0.75rem;font-weight:600;display:flex;align-items:center;gap:0.5rem}
.panel-section h3 .tag{font-size:0.65rem;background:rgba(0,245,255,0.1);border:1px solid rgba(0,245,255,0.2);padding:0.15rem 0.5rem;border-radius:4px;font-family:var(--font-mono)}
.panel-section p{color:var(--text-secondary);font-size:0.9rem;line-height:1.7}
.panel-section ul{list-style:none;padding:0}
.panel-section ul li{padding:0.5rem 0;border-bottom:1px solid rgba(255,255,255,0.05);color:var(--text-secondary);font-size:0.9rem;display:flex;align-items:flex-start;gap:0.5rem}
.panel-section ul li::before{content:'\u25b8';color:var(--neon-purple);flex-shrink:0}
.code-block{background:rgba(0,0,0,0.5);border:1px solid var(--glass-border);border-radius:var(--radius-sm);padding:1rem;margin:0.75rem 0;font-family:var(--font-mono);font-size:0.8rem;color:var(--neon-green);overflow-x:auto;white-space:pre-wrap;word-break:break-all}
.flow-box{background:rgba(0,245,255,0.05);border:1px solid rgba(0,245,255,0.15);border-radius:var(--radius-sm);padding:1rem;margin:0.75rem 0}
.flow-box .step{display:flex;align-items:center;gap:1rem;padding:0.5rem 0;color:var(--text-secondary);font-size:0.85rem}
.flow-box .step .arrow{color:var(--neon-purple);font-size:1.2rem}
.flow-box .step .num{width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,var(--neon-cyan),var(--neon-purple));display:flex;align-items:center;justify-content:center;font-size:0.75rem;font-weight:700;color:#fff;flex-shrink:0}
.qa-item{background:rgba(123,97,255,0.05);border:1px solid rgba(123,97,255,0.15);border-radius:var(--radius-sm);padding:1rem;margin:0.75rem 0;cursor:pointer;transition:all 0.3s}
.qa-item:hover{border-color:var(--neon-purple)}
.qa-item .q{color:var(--neon-yellow);font-weight:600;font-size:0.9rem}
.qa-item .a{color:var(--text-secondary);font-size:0.85rem;margin-top:0.5rem;display:none}
.qa-item.open .a{display:block}
.connector-box{background:rgba(255,209,102,0.05);border:1px solid rgba(255,209,102,0.15);border-radius:var(--radius-sm);padding:1rem;margin:0.75rem 0}
.connector-box .conn-row{display:flex;align-items:center;gap:0.75rem;padding:0.4rem 0;font-size:0.85rem}
.connector-box .conn-row .from{color:var(--neon-cyan);font-weight:500}
.connector-box .conn-row .to{color:var(--neon-green);font-weight:500}
.connector-box .conn-row .via{color:var(--text-muted);font-family:var(--font-mono);font-size:0.75rem}
#complete-flow{position:relative;z-index:1;padding:4rem 2rem;background:linear-gradient(180deg,transparent,var(--bg-secondary))}
.flow-steps{max-width:800px;margin:0 auto;position:relative}
.flow-steps::before{content:'';position:absolute;left:28px;top:0;bottom:0;width:2px;background:linear-gradient(180deg,var(--neon-cyan),var(--neon-purple),var(--neon-pink))}
.flow-step{display:flex;align-items:flex-start;gap:1.5rem;padding:1.5rem 0;position:relative}
.flow-step .dot{width:56px;height:56px;border-radius:50%;background:linear-gradient(135deg,var(--neon-cyan),var(--neon-purple));display:flex;align-items:center;justify-content:center;font-size:1.25rem;flex-shrink:0;z-index:1;box-shadow:0 0 20px rgba(123,97,255,0.3)}
.flow-step .content h4{font-size:1rem;color:var(--text-primary);margin-bottom:0.3rem}
.flow-step .content p{font-size:0.85rem;color:var(--text-secondary);line-height:1.5}
.quiz-modal{position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.85);z-index:300;display:none;align-items:center;justify-content:center;padding:2rem}
.quiz-modal.active{display:flex}
.quiz-card{background:var(--bg-primary);border:1px solid var(--glass-border);border-radius:var(--radius-lg);padding:2.5rem;max-width:650px;width:100%;max-height:85vh;overflow-y:auto;position:relative;box-shadow:var(--shadow-glow)}
.quiz-card h2{font-family:var(--font-display);font-size:1.25rem;background:linear-gradient(135deg,var(--neon-yellow),var(--neon-red));-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:0.5rem}
.quiz-progress{height:4px;background:rgba(255,255,255,0.1);border-radius:2px;margin-bottom:1rem;overflow:hidden}
.quiz-progress .bar{height:100%;background:linear-gradient(90deg,var(--neon-yellow),var(--neon-red));transition:width 0.5s;border-radius:2px}
.quiz-meta{display:flex;justify-content:space-between;font-size:0.8rem;color:var(--text-muted);margin-bottom:1.5rem}
.quiz-q{font-size:1.15rem;color:var(--text-primary);padding:1.25rem;background:rgba(255,209,102,0.05);border:1px solid rgba(255,209,102,0.15);border-radius:var(--radius);margin-bottom:1.25rem;line-height:1.6}
.quiz-options{display:flex;flex-direction:column;gap:0.75rem;margin-bottom:1.5rem}
.quiz-opt{padding:0.9rem 1.25rem;background:var(--glass-bg);border:1px solid var(--glass-border);border-radius:var(--radius-sm);color:var(--text-secondary);cursor:pointer;transition:all 0.3s;font-size:0.9rem;text-align:left;font-family:var(--font-body)}
.quiz-opt:hover{border-color:var(--neon-yellow);color:var(--text-primary)}
.quiz-opt.correct{border-color:var(--neon-green);background:rgba(0,255,163,0.1);color:var(--neon-green)}
.quiz-opt.wrong{border-color:var(--neon-red);background:rgba(255,77,109,0.1);color:var(--neon-red)}
.quiz-opt.disabled{pointer-events:none;opacity:0.6}
.quiz-opt .lbl{display:inline-block;width:24px;height:24px;border-radius:50%;background:rgba(255,255,255,0.05);text-align:center;line-height:24px;font-size:0.75rem;margin-right:0.75rem;font-weight:600;flex-shrink:0}
.quiz-opt.correct .lbl{background:var(--neon-green);color:#000}
.quiz-opt.wrong .lbl{background:var(--neon-red);color:#fff}
.quiz-feedback{font-size:0.85rem;padding:0.75rem 1rem;border-radius:var(--radius-sm);margin-bottom:1rem;display:none}
.quiz-feedback.show{display:block}
.quiz-feedback.correct{border:1px solid rgba(0,255,163,0.3);background:rgba(0,255,163,0.05);color:var(--neon-green)}
.quiz-feedback.wrong{border:1px solid rgba(255,77,109,0.3);background:rgba(255,77,109,0.05);color:var(--neon-red)}
.quiz-next{padding:0.75rem 1.5rem;background:linear-gradient(135deg,var(--neon-yellow),var(--neon-red));border:none;border-radius:var(--radius-sm);color:#fff;font-weight:600;cursor:pointer;font-family:var(--font-body);transition:all 0.3s;display:none}
.quiz-next.show{display:block}
.quiz-next:hover{transform:translateY(-2px);box-shadow:0 0 20px rgba(255,77,109,0.3)}
.quiz-result{text-align:center;padding:2rem}
.quiz-result .big-num{font-family:var(--font-display);font-size:4rem}
.quiz-result .msg{font-size:1.1rem;margin:1rem 0;color:var(--text-secondary)}
.quiz-restart{padding:0.75rem 1.5rem;background:linear-gradient(135deg,var(--neon-cyan),var(--neon-purple));border:none;border-radius:var(--radius-sm);color:#fff;font-weight:600;cursor:pointer;font-family:var(--font-body);margin-top:1rem;transition:all 0.3s}
.quiz-restart:hover{transform:translateY(-2px);box-shadow:0 0 20px rgba(123,97,255,0.3)}
.btn-close-quiz{position:absolute;top:1rem;right:1rem;background:none;border:none;color:var(--text-secondary);font-size:1.5rem;cursor:pointer}
.viva-modal{position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.85);z-index:300;display:none;align-items:center;justify-content:center;padding:2rem}
.viva-modal.active{display:flex}
.viva-card{background:var(--bg-primary);border:1px solid var(--glass-border);border-radius:var(--radius-lg);padding:2.5rem;max-width:600px;width:100%;max-height:80vh;overflow-y:auto;position:relative;box-shadow:var(--shadow-glow)}
.viva-card h2{font-family:var(--font-display);font-size:1.25rem;background:linear-gradient(135deg,var(--neon-cyan),var(--neon-purple));-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:1rem}
.viva-card .question{font-size:1.1rem;color:var(--text-primary);margin:2rem 0 1rem;padding:1.5rem;background:rgba(123,97,255,0.05);border:1px solid rgba(123,97,255,0.15);border-radius:var(--radius)}
.viva-card .answer{color:var(--text-secondary);font-size:0.9rem;line-height:1.7;display:none;margin-bottom:1.5rem;padding:1rem;background:rgba(0,245,255,0.05);border-radius:var(--radius-sm);border-left:3px solid var(--neon-cyan)}
.viva-card .answer.show{display:block}
.viva-btn-group{display:flex;gap:1rem;flex-wrap:wrap;margin-top:1.5rem}
.viva-btn-group button{flex:1;min-width:120px;padding:0.75rem 1.5rem;border:none;border-radius:var(--radius-sm);font-weight:600;cursor:pointer;transition:all 0.3s;font-family:var(--font-body)}
.btn-reveal{background:linear-gradient(135deg,var(--neon-cyan),var(--neon-purple));color:#fff}
.btn-reveal:hover{transform:translateY(-2px);box-shadow:0 0 20px rgba(0,245,255,0.3)}
.btn-next{background:rgba(255,255,255,0.1);color:var(--text-primary);border:1px solid var(--glass-border)!important}
.btn-next:hover{background:rgba(255,255,255,0.15)}
.btn-close-viva{position:absolute;top:1rem;right:1rem;background:none;border:none;color:var(--text-secondary);font-size:1.5rem;cursor:pointer}
.viva-progress{height:4px;background:rgba(255,255,255,0.1);border-radius:2px;margin-bottom:1.5rem;overflow:hidden}
.viva-progress .bar{height:100%;background:linear-gradient(90deg,var(--neon-cyan),var(--neon-purple));transition:width 0.5s;border-radius:2px}
.viva-score{text-align:center;padding:1rem;background:rgba(0,255,163,0.05);border-radius:var(--radius-sm);margin-top:1rem}
.viva-score .num{font-family:var(--font-display);font-size:2rem;color:var(--neon-green)}
.tech-stack{position:relative;z-index:1;padding:4rem 2rem}
.tech-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:1rem;max-width:1000px;margin:0 auto}
.tech-item{background:var(--glass-bg);border:1px solid var(--glass-border);border-radius:var(--radius-sm);padding:1rem;text-align:center;transition:all 0.3s;backdrop-filter:blur(10px)}
.tech-item:hover{border-color:var(--neon-purple);transform:translateY(-2px)}
.tech-item .v{font-size:0.7rem;color:var(--neon-cyan);font-family:var(--font-mono);margin-bottom:0.25rem}
.tech-item .n{font-size:0.85rem;color:var(--text-primary);font-weight:500}
.tech-item .cat{font-size:0.65rem;color:var(--text-muted);margin-top:0.2rem;padding:0.1rem 0.4rem;border-radius:3px;display:inline-block}
.search-bar{position:relative;z-index:1;max-width:400px;margin:0 auto 3rem}
.search-bar input{width:100%;padding:0.75rem 1rem 0.75rem 3rem;background:var(--glass-bg);border:1px solid var(--glass-border);border-radius:100px;color:var(--text-primary);font-family:var(--font-body);font-size:0.9rem;outline:none;transition:border-color 0.3s}
.search-bar input:focus{border-color:var(--neon-cyan)}
.search-bar .icon{position:absolute;left:1.2rem;top:50%;transform:translateY(-50%);color:var(--text-muted)}
footer{position:relative;z-index:1;text-align:center;padding:3rem 2rem;border-top:1px solid var(--glass-border);color:var(--text-muted);font-size:0.85rem}
.fade-in{animation:fadeIn 0.6s ease forwards}
@keyframes fadeIn{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
@media(max-width:768px){
  nav{padding:0 1rem}
  .nav-links{display:none;position:absolute;top:64px;left:0;right:0;background:rgba(3,7,18,0.95);flex-direction:column;padding:1rem;border-bottom:1px solid var(--glass-border)}
  .nav-links.active{display:flex}
  .mobile-toggle{display:block}
  .hero{padding:5rem 1rem 3rem}
  .hero-stats{gap:1.5rem}
  .nodes-grid{grid-template-columns:repeat(auto-fit,minmax(140px,1fr))}
  .panel{width:100vw;padding:1.25rem}
  .flow-step .dot{width:44px;height:44px;font-size:1rem}
  .flow-steps::before{left:22px}
  .structure-container{font-size:0.75rem;padding:1rem}
}
@media(max-width:480px){
  .nodes-grid{grid-template-columns:repeat(2,1fr)}
  .viva-btn-group,.quiz-options{flex-direction:column}
  .quiz-card,.viva-card{padding:1.5rem}
}
</style>
</head>
<body>

<canvas id="particles-canvas"></canvas>

<nav>
  <div class="nav-logo">\u25c8 ${d.project.name}</div>
  <div class="mobile-toggle" onclick="document.querySelector('.nav-links').classList.toggle('active')">\u2630</div>
  <div class="nav-links">
    <a onclick="scrollTo('architecture')">Architecture</a>
    <a onclick="scrollTo('structure')">Root Structure</a>
    <a onclick="scrollTo('roadmap')">Modules</a>
    <a onclick="scrollTo('complete-flow')">Data Flow</a>
    <button class="viva-btn" onclick="openViva()">\uD83C\uDFA4 Viva</button>
    <button class="quiz-btn" onclick="openQuiz()">\uD83E\uDDE0 Quiz</button>
  </div>
</nav>

<section class="hero">
  <div class="hero-badge">\uD83C\uDF93 BCA Final Year Project — Full Stack + Blockchain</div>
  <h1>${d.project.name}</h1>
  <p>${d.project.description}</p>
  <div class="hero-stats" id="heroStats"></div>
</section>

<section id="architecture">
  <div class="section-title fade-in">
    <h2>\uD83C\uDFD7\uFE0F System Architecture</h2>
    <p>How the four layers connect — click any box to explore</p>
  </div>
  <div class="arch-canvas">
    <svg class="arch-svg" viewBox="0 0 960 540" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="g1" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#00F5FF"/><stop offset="100%" stop-color="#7B61FF"/></linearGradient>
        <linearGradient id="g2" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#7B61FF"/><stop offset="100%" stop-color="#FF4FD8"/></linearGradient>
        <linearGradient id="g3" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#00FFA3"/><stop offset="100%" stop-color="#00F5FF"/></linearGradient>
        <linearGradient id="g4" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#FFD166"/><stop offset="100%" stop-color="#FF4D6D"/></linearGradient>
        <filter id="glow"><feDropShadow dx="0" dy="0" stdDeviation="6" flood-color="#7B61FF" flood-opacity="0.4"/></filter>
      </defs>
      <rect width="960" height="540" rx="16" fill="rgba(15,20,35,0.5)"/>
      <pattern id="grid" width="30" height="30" patternUnits="userSpaceOnUse"><rect width="30" height="30" fill="none" stroke="rgba(123,97,255,0.05)" stroke-width="0.5"/></pattern>
      <rect width="960" height="540" fill="url(#grid)" rx="16"/>
      <g class="arch-layer" onclick="openPanel('frontend')">
        <rect x="320" y="30" width="320" height="70" rx="12" fill="rgba(0,245,255,0.08)" stroke="var(--neon-cyan)" stroke-width="1.5" filter="url(#glow)"/>
        <text x="480" y="60" text-anchor="middle" fill="var(--neon-cyan)" font-family="var(--font-display)" font-size="14" font-weight="700">\uD83C\uDFA8 FRONTEND</text>
        <text x="480" y="82" text-anchor="middle" fill="var(--text-muted)" font-family="var(--font-body)" font-size="10">React 19 · Vite 7 · Tailwind · wagmi</text>
      </g>
      <g class="arch-layer" onclick="openPanel('backend')">
        <rect x="320" y="140" width="320" height="70" rx="12" fill="rgba(123,97,255,0.08)" stroke="var(--neon-purple)" stroke-width="1.5" filter="url(#glow)"/>
        <text x="480" y="170" text-anchor="middle" fill="var(--neon-purple)" font-family="var(--font-display)" font-size="14" font-weight="700">\u2699\uFE0F BACKEND</text>
        <text x="480" y="192" text-anchor="middle" fill="var(--text-muted)" font-family="var(--font-body)" font-size="10">Express 4 · Node 22 · JWT · Socket.IO</text>
      </g>
      <g>
        <path class="arch-arrow" d="M480 100 L480 130" stroke="var(--neon-cyan)" stroke-width="2" marker-end="url(#arrowC)"/>
        <path class="arch-arrow" d="M480 100 L480 130" stroke="var(--neon-cyan)" stroke-dasharray="6,6" stroke-width="1.5" opacity="0.5"/>
      </g>
      <g class="arch-layer" onclick="openPanel('database')">
        <rect x="120" y="250" width="250" height="70" rx="12" fill="rgba(0,255,163,0.08)" stroke="var(--neon-green)" stroke-width="1.5" filter="url(#glow)"/>
        <text x="245" y="280" text-anchor="middle" fill="var(--neon-green)" font-family="var(--font-display)" font-size="14" font-weight="700">\uD83D\uDDC4\uFE0F DATABASE</text>
        <text x="245" y="302" text-anchor="middle" fill="var(--text-muted)" font-family="var(--font-body)" font-size="10">MongoDB Atlas · Mongoose 9 · 19 Models</text>
      </g>
      <g class="arch-layer" onclick="openPanel('blockchain')">
        <rect x="590" y="250" width="250" height="70" rx="12" fill="rgba(255,77,109,0.08)" stroke="var(--neon-red)" stroke-width="1.5" filter="url(#glow)"/>
        <text x="715" y="280" text-anchor="middle" fill="var(--neon-red)" font-family="var(--font-display)" font-size="14" font-weight="700">\u26D3\uFE0F BLOCKCHAIN</text>
        <text x="715" y="302" text-anchor="middle" fill="var(--text-muted)" font-family="var(--font-body)" font-size="10">Polygon Amoy · Solidity · ERC-721</text>
      </g>
      <g>
        <path class="arch-arrow" d="M400 210 L300 240" stroke="var(--neon-purple)" stroke-width="2" marker-end="url(#arrowP)"/>
        <path class="arch-arrow" d="M560 210 L660 240" stroke="var(--neon-purple)" stroke-width="2" marker-end="url(#arrowP)"/>
      </g>
      <g>
        <rect x="180" y="370" width="600" height="60" rx="12" fill="rgba(255,209,102,0.06)" stroke="var(--neon-yellow)" stroke-width="1" stroke-dasharray="6,4"/>
        <text x="480" y="398" text-anchor="middle" fill="var(--neon-yellow)" font-family="var(--font-display)" font-size="12" font-weight="600">\u2601\uFE0F INFRASTRUCTURE</text>
        <text x="480" y="416" text-anchor="middle" fill="var(--text-muted)" font-family="var(--font-body)" font-size="9">GitHub Pages (Frontend) \u00b7 Render/Railway (Backend) \u00b7 MongoDB Atlas \u00b7 IPFS/Pinata</text>
      </g>
      <g>
        <path class="arch-arrow" d="M245 320 L300 360" stroke="var(--neon-green)" stroke-width="1.5"/>
        <path class="arch-arrow" d="M715 320 L660 360" stroke="var(--neon-red)" stroke-width="1.5"/>
      </g>
      <text x="80" y="180" fill="var(--text-muted)" font-family="var(--font-mono)" font-size="9">REST API</text>
      <text x="80" y="195" fill="var(--text-muted)" font-family="var(--font-mono)" font-size="9">WS/Socket.IO</text>
      <text x="870" y="180" fill="var(--text-muted)" font-family="var(--font-mono)" font-size="9">ethers.js</text>
      <text x="870" y="195" fill="var(--text-muted)" font-family="var(--font-mono)" font-size="9">Web3</text>
      <text x="320" y="240" fill="var(--text-muted)" font-family="var(--font-mono)" font-size="8" opacity="0.7">Mongoose ODM</text>
      <text x="568" y="240" fill="var(--text-muted)" font-family="var(--font-mono)" font-size="8" opacity="0.7">ethers Contract</text>
      <rect x="20" y="490" width="920" height="35" rx="8" fill="rgba(255,255,255,0.02)" stroke="rgba(255,255,255,0.05)" stroke-width="1"/>
      <text x="480" y="513" text-anchor="middle" fill="var(--text-muted)" font-family="var(--font-mono)" font-size="9">\uD83D\uDCA1 Click any box to open its module details — arrows show the data flow direction</text>
      <marker id="arrowC" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8" fill="var(--neon-cyan)"/></marker>
      <marker id="arrowP" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8" fill="var(--neon-purple)"/></marker>
    </svg>
  </div>
</section>

<section id="structure">
  <div class="section-title fade-in">
    <h2>\uD83D\uDCC2 Root Project Structure</h2>
    <p>Full directory tree — click folder icons to expand/collapse</p>
  </div>
  <div class="structure-container" id="treeContainer">
    <div class="tree-line"><span class="icon">\uD83D\uDCE6</span><span class="name dir" style="font-family:var(--font-display);font-size:0.9rem">Blockchain Enabled Virtual Campus Platform</span><span class="badge">ROOT</span></div>
    <div id="treeRoot"></div>
  </div>
</section>

<section id="roadmap">
  <div class="section-title fade-in">
    <h2>\uD83D\uDDFA Interactive Learning Modules</h2>
    <p>Click any module to explore detailed explanations, connections, code, and viva questions</p>
  </div>
  <div class="search-bar">
    <span class="icon">\uD83D\uDD0D</span>
    <input type="text" id="searchInput" placeholder="Search modules..." oninput="filterNodes(this.value)">
  </div>
  <div class="roadmap-container">
    <div class="nodes-grid" id="nodesGrid"></div>
  </div>
</section>

<section id="complete-flow">
  <div class="section-title fade-in">
    <h2>\uD83D\uDD04 End-to-End Data Flow</h2>
    <p>A student earning an NFT certificate — tracing through every layer</p>
  </div>
  <div class="flow-steps" id="flowSteps"></div>
</section>

<section id="tech-stack" class="tech-stack">
  <div class="section-title fade-in">
    <h2>\u2699\uFE0F Technology Stack</h2>
  </div>
  <div class="tech-grid" id="techGrid"></div>
</section>

<div class="panel-overlay" id="panelOverlay" onclick="closePanel()"></div>
<div class="panel" id="sidePanel">
  <button class="panel-close" onclick="closePanel()">\u2715</button>
  <div id="panelContent"></div>
</div>

<div class="viva-modal" id="vivaModal">
  <div class="viva-card">
    <button class="btn-close-viva" onclick="closeViva()">\u2715</button>
    <h2>\uD83C\uDFA4 Viva Preparation</h2>
    <div class="viva-progress"><div class="bar" id="vivaProgress" style="width:0%"></div></div>
    <div id="vivaScore" style="display:none"></div>
    <div id="vivaQuestion"></div>
    <div id="vivaAnswer" class="answer"></div>
    <div class="viva-btn-group" id="vivaButtons"></div>
  </div>
</div>

<div class="quiz-modal" id="quizModal">
  <div class="quiz-card">
    <button class="btn-close-quiz" onclick="closeQuiz()">\u2715</button>
    <h2>\uD83E\uDDE0 Random Knowledge Quiz</h2>
    <div class="quiz-progress"><div class="bar" id="quizProgress" style="width:0%"></div></div>
    <div class="quiz-meta">
      <span id="quizCounter">Question 1 of 10</span>
      <span id="quizScore">Score: 0</span>
    </div>
    <div id="quizArea"></div>
  </div>
</div>

<footer>
  <p>${d.project.name} — ${d.project.tagline} \u2022 Built with React \u2022 Express \u2022 MongoDB \u2022 Solidity</p>
</footer>

<script>
// ========= DATA =========
const nodes = ${nodesJSON};

const flowStepsData = ${flowStepsJSON};

const techStack = ${techStackJSON};

const treeData = ${treeDataJSON};

// ========= HERO RENDER =========
function renderHeroStats() {
  const el = document.getElementById("heroStats");
  const stats = ${JSON.stringify(d.heroStats)};
  el.innerHTML = stats.map(s =>
    \`<div class="hero-stat"><div class="num">\${s.num}</div><div class="label">\${s.label}</div></div>\`
  ).join("");
}

// ========= QUIZ DATA =========
function buildQuizQuestions() {
  const qs = [];
  nodes.forEach(n => (n.sections||[]).forEach(s => {
    (s.qa||[]).forEach(pair => {
      const opts = [pair.a];
      const others = [];
      nodes.forEach(n2 => (n2.sections||[]).forEach(s2 => (s2.qa||[]).forEach(q2 => {
        if (q2.a !== pair.a) others.push(q2.a);
      })));
      const shuffled = others.sort(()=>Math.random()-0.5).slice(0,3);
      while (shuffled.length < 3) shuffled.push("This concept is not directly related.");
      const allOpts = [pair.a, ...shuffled].sort(()=>Math.random()-0.5);
      qs.push({
        question: pair.q,
        options: allOpts,
        correct: allOpts.indexOf(pair.a),
        module: n.title,
      });
    });
  }));
  return qs;
}

// ========= RENDER =========
function renderNodes() {
  const grid = document.getElementById("nodesGrid");
  grid.innerHTML = nodes.map(n =>
    \`<div class="node-card fade-in" style="animation-delay:\${Math.random()*0.3}s" onclick="openPanel('\${n.id}')">
      <div class="icon">\${n.icon}</div>
      <h3>\${n.title}</h3>
      <p>\${n.short}</p>
    </div>\`
  ).join("");
}

function renderFlow() {
  const el = document.getElementById("flowSteps");
  el.innerHTML = flowStepsData.map(f =>
    \`<div class="flow-step fade-in">
      <div class="dot">\${f.icon}</div>
      <div class="content">
        <h4>\${f.title}</h4>
        <p>\${f.desc}</p>
      </div>
    </div>\`
  ).join("");
}

function renderTech() {
  const grid = document.getElementById("techGrid");
  grid.innerHTML = techStack.map(t =>
    \`<div class="tech-item">
      <div class="v">\${t.v}</div>
      <div class="n">\${t.n}</div>
      <div class="cat" style="color:\${t.cat==='Frontend'?'var(--neon-cyan)':t.cat==='Backend'?'var(--neon-purple)':t.cat==='Database'?'var(--neon-green)':t.cat.includes('Blockchain')||t.cat==='Blockchain/Web3'?'var(--neon-red)':t.cat==='Frontend/Web3'?'var(--neon-pink)':'var(--neon-yellow)'}">\${t.cat}</div>
    </div>\`
  ).join("");
}

function renderTree(parent, data, depth=0, isLast=true) {
  const isDir = data.type === "dir" && data.children;
  const hasBadge = data.badge;
  const badgeColor = data.badgeClass || "";

  const div = document.createElement("div");
  div.className = "tree-line";
  div.style.paddingLeft = (depth * 1.5) + "rem";

  const toggleBtn = isDir ? \`<button class="tree-toggle" onclick="toggleTree(this)">\u25bc</button>\` : \`<span class="tree-toggle" style="visibility:hidden">\u00a0</span>\`;

  div.innerHTML = \`\${toggleBtn}<span class="icon">\${data.icon||(isDir?"\uD83D\uDCC1":"\uD83D\uDCC4")}</span><span class="name \${isDir?'dir':'file'}">\${data.name}</span>\${hasBadge?\`<span class="badge \${badgeColor}">\${data.badge}</span>\`:""}\`;
  parent.appendChild(div);

  if (isDir && data.children) {
    const container = document.createElement("div");
    container.className = "tree-children";
    data.children.forEach((child, i) => {
      const last = i === data.children.length - 1;
      const el = renderTree(container, child, depth + 1, last);
      container.appendChild(el);
    });
    parent.appendChild(container);
  }
  return div;
}

function toggleTree(btn) {
  const container = btn.parentElement.nextElementSibling;
  if (container && container.classList.contains("tree-children")) {
    container.classList.toggle("hidden");
    btn.textContent = container.classList.contains("hidden") ? "\u25b6" : "\u25bc";
  }
}

function openPanel(id) {
  const node = nodes.find(n => n.id === id);
  if (!node) return;
  const panel = document.getElementById("sidePanel");
  const overlay = document.getElementById("panelOverlay");
  const content = document.getElementById("panelContent");

  let html = \`<h2>\${node.icon} \${node.title}</h2>\`;

  if (node.connectsTo) {
    html += \`<div class="panel-section">
      <h3>\uD83D\uDD17 Connections <span class="tag">\${node.connectsTo.length} links</span></h3>
      <p style="margin-bottom:0.5rem">Connects to: \${node.connectsTo.map(c => {
        const n = nodes.find(x => x.id === c);
        return n ? \`<span style="color:var(--neon-cyan);font-weight:500">\${n.icon} \${n.title}</span>\` : c;
      }).join(" \\u2192 ")}</p>
      <div class="connector-box">
        \${(node.connectsVia||"").split("\u00b7").map(v => \`<div class="conn-row"><span class="from">\${node.title}</span> <span style="color:var(--text-muted)">\u2014\u2014</span> <span class="via">\${v.trim()}</span> <span style="color:var(--text-muted)">\u2014\u2014</span> <span class="to">...</span></div>\`).join("")}
      </div>
    </div>\`;
  }

  node.sections.forEach(s => {
    html += \`<div class="panel-section">\`;
    html += \`<h3>\${s.icon||"\uD83D\uDCCC"} \${s.title}</h3>\`;

    if (s.isConnector && s.connections) {
      html += \`<div class="connector-box">\`;
      s.connections.forEach(c => {
        html += \`<div class="conn-row"><span class="from">\${c.from}</span> <span style="color:var(--text-muted)">\\u2192</span> <span class="via">\${c.via}</span> <span style="color:var(--text-muted)">\\u2192</span> <span class="to">\${c.to}</span></div>\`;
      });
      html += \`</div>\`;
    } else if (s.content) {
      html += \`<p>\${s.content}</p>\`;
    }

    if (s.flow) {
      html += \`<div class="flow-box">\`;
      s.flow.forEach(f => {
        html += \`<div class="step"><span class="num">\${f.num}</span><span>\${f.text}</span></div>\`;
      });
      html += \`</div>\`;
    }

    if (s.code) {
      html += \`<div class="code-block">\${s.code.replace(/</g,"&lt;").replace(/>/g,"&gt;")}</div>\`;
    }

    if (s.qa) {
      s.qa.forEach(q => {
        html += \`<div class="qa-item" onclick="this.classList.toggle('open')">
          <div class="q">\${q.q} <span class="toggle">\u25bc</span></div>
          <div class="a">\${q.a}</div>
        </div>\`;
      });
    }

    html += \`</div>\`;
  });

  content.innerHTML = html;
  panel.classList.add("open");
  overlay.classList.add("active");
  document.body.style.overflow = "hidden";
}

function closePanel() {
  document.getElementById("sidePanel").classList.remove("open");
  document.getElementById("panelOverlay").classList.remove("active");
  document.body.style.overflow = "";
}

function filterNodes(val) {
  const cards = document.querySelectorAll(".node-card");
  const q = val.toLowerCase().trim();
  cards.forEach(c => {
    const t = c.textContent.toLowerCase();
    c.style.display = (!q || t.includes(q)) ? "" : "none";
  });
}

function scrollTo(id) {
  document.getElementById(id).scrollIntoView({behavior:"smooth"});
  document.querySelector(".nav-links")?.classList.remove("active");
}

// ========= VIVA =========
let vivaIndex = 0, vivaQuestions = [];

function openViva() {
  vivaQuestions = [];
  nodes.forEach(n => (n.sections||[]).forEach(s => (s.qa||[]).forEach(q => vivaQuestions.push({...q,module:n.title,icon:n.icon}))));
  vivaQuestions.sort(()=>Math.random()-0.5);
  vivaIndex = 0;
  document.getElementById("vivaModal").classList.add("active");
  document.getElementById("vivaScore").style.display = "none";
  document.getElementById("vivaProgress").style.width = "0%";
  showVivaQuestion();
}

function closeViva() {
  document.getElementById("vivaModal").classList.remove("active");
}

function showVivaQuestion() {
  const q = vivaQuestions[vivaIndex];
  const total = vivaQuestions.length;
  if (!q) { document.getElementById("vivaQuestion").innerHTML = "<div class='viva-score'><div class='num'>\uD83C\uDF89</div><p>All questions covered!</p></div>"; return; }

  document.getElementById("vivaProgress").style.width = ((vivaIndex)/total*100)+"%";
  document.getElementById("vivaQuestion").innerHTML =
    \`<div class="question">\${q.icon||"\uD83C\uDFA4"} \${q.q} <span style="font-size:0.75rem;color:var(--text-muted);display:block;margin-top:0.5rem">\u2014 \${q.module}</span></div>\`;
  document.getElementById("vivaAnswer").classList.remove("show");
  document.getElementById("vivaAnswer").innerHTML = q.a;
  document.getElementById("vivaButtons").innerHTML =
    \`<button class="btn-reveal" onclick="revealViva()">Reveal Answer</button>
     <button class="btn-next" onclick="nextViva()">Next (\${vivaIndex+1}/\${total})</button>\`;
}

function revealViva() {
  document.getElementById("vivaAnswer").classList.add("show");
}

function nextViva() {
  vivaIndex++;
  if (vivaIndex >= vivaQuestions.length) {
    document.getElementById("vivaQuestion").innerHTML =
      \`<div class="viva-score"><div class="num">\u2705</div><p>You've reviewed all \${vivaQuestions.length} questions!</p></div>\`;
    document.getElementById("vivaButtons").innerHTML = '<button class="btn-reveal" onclick="closeViva()">Close</button>';
    document.getElementById("vivaProgress").style.width = "100%";
    return;
  }
  showVivaQuestion();
}

// ========= QUIZ =========
let quizQs = [], quizIdx = 0, quizCorrect = 0, quizAnswered = false, TOTAL_QS = 10;

function openQuiz() {
  quizQs = buildQuizQuestions().sort(()=>Math.random()-0.5).slice(0,TOTAL_QS);
  quizIdx = 0; quizCorrect = 0; quizAnswered = false;
  document.getElementById("quizModal").classList.add("active");
  showQuiz();
}

function closeQuiz() {
  document.getElementById("quizModal").classList.remove("active");
}

function showQuiz() {
  const area = document.getElementById("quizArea");
  if (quizIdx >= quizQs.length) {
    const pct = Math.round(quizCorrect/quizQs.length*100);
    let msg, emoji;
    if (pct >= 90) { msg = "Outstanding! You're a Web3 expert!"; emoji = "\uD83C\uDFC6"; }
    else if (pct >= 70) { msg = "Great job! You know your stack well."; emoji = "\uD83C\uDF1F"; }
    else if (pct >= 50) { msg = "Good start! Keep learning."; emoji = "\uD83D\uDCDA"; }
    else { msg = "Keep studying! This stuff is complex."; emoji = "\uD83D\uDCAA"; }
    area.innerHTML = \`<div class="quiz-result">
      <div class="big-num">\${emoji}</div>
      <div class="num" style="font-size:3rem;font-family:var(--font-display);background:linear-gradient(135deg,var(--neon-yellow),var(--neon-red));-webkit-background-clip:text;-webkit-text-fill-color:transparent">\${quizCorrect}/\${quizQs.length}</div>
      <div class="msg">\${msg}</div>
      <button class="quiz-restart" onclick="openQuiz()">\uD83D\uDD04 Try Again</button>
    </div>\`;
    document.getElementById("quizCounter").textContent = "Complete!";
    document.getElementById("quizScore").textContent = \`Score: \${quizCorrect}/\${quizQs.length}\`;
    document.getElementById("quizProgress").style.width = "100%";
    return;
  }

  const q = quizQs[quizIdx];
  document.getElementById("quizCounter").textContent = \`Question \${quizIdx+1} of \${quizQs.length}\`;
  document.getElementById("quizScore").textContent = \`Score: \${quizCorrect}\`;
  document.getElementById("quizProgress").style.width = \`\${(quizIdx/quizQs.length)*100}%\`;
  quizAnswered = false;

  const letters = ["A","B","C","D"];
  let html = \`<div class="quiz-q"><span style="color:var(--neon-cyan);font-size:0.8rem;display:block;margin-bottom:0.5rem;">[\${q.module}]</span>\${q.question}</div>\`;
  html += \`<div class="quiz-options">\`;
  q.options.forEach((opt, i) => {
    html += \`<button class="quiz-opt" data-idx="\${i}" onclick="answerQuiz(\${i})">
      <span class="lbl">\${letters[i]}</span>\${opt}
    </button>\`;
  });
  html += \`</div>\`;
  html += \`<div class="quiz-feedback" id="quizFeedback"></div>\`;
  html += \`<button class="quiz-next" id="quizNextBtn" onclick="nextQuiz()">Next \u2192</button>\`;
  area.innerHTML = html;
}

function answerQuiz(idx) {
  if (quizAnswered) return;
  quizAnswered = true;
  const q = quizQs[quizIdx];
  const opts = document.querySelectorAll(".quiz-opt");
  opts.forEach(o => o.classList.add("disabled"));

  if (idx === q.correct) {
    opts[idx].classList.add("correct");
    quizCorrect++;
    document.getElementById("quizScore").textContent = \`Score: \${quizCorrect}\`;
    showFeedback(true, "\u2705 Correct! " + (q.options[idx]));
  } else {
    opts[idx].classList.add("wrong");
    opts[q.correct].classList.add("correct");
    showFeedback(false, \`\u274C Oops! The correct answer was: \${q.options[q.correct]}\`);
  }
  document.getElementById("quizNextBtn").classList.add("show");
}

function showFeedback(isCorrect, msg) {
  const fb = document.getElementById("quizFeedback");
  fb.textContent = msg;
  fb.className = "quiz-feedback show " + (isCorrect ? "correct" : "wrong");
}

function nextQuiz() {
  quizIdx++;
  showQuiz();
}

// ========= PARTICLES =========
function particles() {
  const canvas = document.getElementById("particles-canvas");
  const ctx = canvas.getContext("2d");
  let w, h, particles = [];

  function resize() {
    w = canvas.width = window.innerWidth;
    h = canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener("resize", resize);

  for (let i = 0; i < 80; i++) {
    particles.push({
      x: Math.random() * w, y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      r: Math.random() * 2 + 0.5,
    });
  }

  function draw() {
    ctx.clearRect(0, 0, w, h);
    particles.forEach(p => {
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0) p.x = w; if (p.x > w) p.x = 0;
      if (p.y < 0) p.y = h; if (p.y > h) p.y = 0;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(123,97,255,0.3)";
      ctx.fill();
    });
    requestAnimationFrame(draw);
  }
  draw();
}

// ========= INIT =========
document.addEventListener("DOMContentLoaded", () => {
  particles();
  renderHeroStats();
  renderNodes();
  renderFlow();
  renderTech();

  const treeRoot = document.getElementById("treeRoot");
  treeData.children.forEach(child => renderTree(treeRoot, child, 0, false));

  document.addEventListener("keydown", e => {
    if (e.key === "Escape") { closePanel(); closeViva(); closeQuiz(); }
  });
});
</script>
</body>
</html>`;
}

// Generate both files
const rootHTML = generateRootIndex(data);
const vivaHTML = generateVivaIndex(data);

fs.writeFileSync("index.html", rootHTML, "utf8");
fs.writeFileSync("viva-web3connect/index.html", vivaHTML, "utf8");

console.log("✓ Generated index.html");
console.log("✓ Generated viva-web3connect/index.html");
console.log(`  - ${data.nodes.length} learning modules`);
console.log(`  - ${data.flowSteps.length} flow steps`);
console.log(`  - ${data.techStack.length} technologies`);
