/* ==========================================================================
   GOLDENMATCH - RESMİ ÜSTÜN MAJESTİK STİL DOSYASI (STYLE.CSS)
   ========================================================================== */

@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700;900&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
  font-family: 'Plus Jakarta Sans', sans-serif;
  -webkit-tap-highlight-color: transparent;
}

body {
  background-color: #0b0a10;
  color: #f0f0f5;
  overflow-x: hidden;
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
}

.app-wrapper {
  width: 100%;
  max-width: 440px;
  height: 100vh;
  max-height: 950px;
  background: #13121d;
  display: flex;
  flex-direction: column;
  position: relative;
  overflow: hidden;
  box-shadow: 0 0 50px rgba(0, 0, 0, 0.9);
  border: 1px solid rgba(212, 175, 55, 0.25);
}

@media(min-width: 441px) {
  .app-wrapper {
    border-radius: 32px;
  }
}

.hidden {
  display: none !important;
}

/* ÜST NAVİGASYON */
.app-nav {
  height: 65px;
  background: rgba(19, 18, 29, 0.94);
  backdrop-filter: blur(14px);
  border-bottom: 1px solid rgba(212, 175, 55, 0.25);
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 18px;
  z-index: 100;
}

.brand-logo {
  font-family: 'Cinzel', serif;
  font-size: 18px;
  font-weight: 800;
  letter-spacing: 1.2px;
  cursor: pointer;
}

.gold-text {
  background: linear-gradient(135deg, #ffffff 0%, #d4af37 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.nav-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.nav-btn {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(212, 175, 55, 0.3);
  color: #fff;
  width: 38px;
  height: 38px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
}

.nav-btn:hover {
  background: rgba(212, 175, 55, 0.2);
}

.yt-badge {
  background: linear-gradient(135deg, #6a11cb, #2575fc) !important;
  font-size: 11px;
  font-weight: 800;
  border: none !important;
}

/* EKRAN AKIŞI */
.view-screen {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
}

.view-screen.hidden {
  display: none !important;
}

.screen-header {
  margin-bottom: 16px;
  text-align: center;
}

.screen-header h1 {
  font-family: 'Cinzel', serif;
  font-size: 24px;
  letter-spacing: 1px;
}

.subtitle {
  font-size: 12px;
  color: #8e8e9a;
  margin-top: 4px;
}

/* FOTOĞRAF IZGARASI */
.photo-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  margin-bottom: 16px;
}

.photo-slot {
  aspect-ratio: 3/4;
  background: rgba(255, 255, 255, 0.04);
  border: 1px dashed rgba(212, 175, 55, 0.4);
  border-radius: 12px;
  position: relative;
  overflow: hidden;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.photo-slot.main {
  grid-column: span 2;
  grid-row: span 2;
  border-style: solid;
  border-color: #d4af37;
}

.slot-preview {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: none;
}

.photo-slot.has-image .slot-preview {
  display: block;
}

.photo-slot.has-image .slot-placeholder {
  display: none;
}

.slot-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  color: #d4af37;
  font-size: 11px;
}

/* FORMLAR */
.gold-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-group label {
  font-size: 11px;
  font-weight: 700;
  color: #d4af37;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.form-group input, .form-group textarea {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 12px;
  padding: 12px;
  color: #fff;
  font-size: 14px;
  outline: none;
  transition: border-color 0.2s;
}

.form-group input:focus, .form-group textarea:focus {
  border-color: #d4af37;
}

.form-row-3 {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 8px;
}

.chip-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.choice-chip {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.12);
  color: #ccc;
  padding: 8px 14px;
  border-radius: 20px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.choice-chip.selected {
  background: #d4af37;
  color: #0b0a10;
  border-color: #d4af37;
  font-weight: 700;
}

.primary-btn {
  background: linear-gradient(135deg, #d4af37, #aa8220);
  color: #0b0a10;
  border: none;
  padding: 14px;
  border-radius: 14px;
  font-weight: 800;
  font-size: 14px;
  cursor: pointer;
  text-align: center;
  box-shadow: 0 4px 20px rgba(212, 175, 55, 0.3);
}

.ghost-btn {
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: #fff;
  padding: 8px 14px;
  border-radius: 12px;
  font-size: 12px;
  cursor: pointer;
}

.sm-btn {
  padding: 6px 12px;
  font-size: 11px;
  border-radius: 10px;
}

/* TINDER KARTLARI */
.lounge-quick-card {
  background: linear-gradient(135deg, #1b1929, #252238);
  border: 1px solid rgba(212, 175, 55, 0.4);
  border-radius: 16px;
  padding: 14px;
  margin-bottom: 12px;
  cursor: pointer;
}

.daily-pick-banner {
  background: rgba(212, 175, 55, 0.1);
  border: 1px solid rgba(212, 175, 55, 0.3);
  border-radius: 14px;
  padding: 12px;
  margin-bottom: 12px;
}

.daily-badge {
  font-size: 10px;
  font-weight: 800;
  color: #d4af37;
  margin-bottom: 4px;
}

.card-stage {
  flex: 1;
  position: relative;
  background: #181624;
  border-radius: 20px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.08);
  min-height: 380px;
  max-height: 480px;
}

.tinder-card {
  width: 100%;
  height: 100%;
  position: relative;
}

.card-loader {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #777;
  font-size: 13px;
  text-align: center;
  padding: 20px;
}

.swipe-actions {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 20px;
  padding: 16px 0;
}

.action-circle {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 20px;
  box-shadow: 0 4px 15px rgba(0,0,0,0.4);
  transition: transform 0.1s;
}

.action-circle:active {
  transform: scale(0.9);
}

.pass-btn {
  background: #1e1c2b;
  color: #ff4757;
  border: 1px solid rgba(255, 71, 87, 0.3);
}

.like-btn {
  background: linear-gradient(135deg, #ff4757, #ff6b81);
  color: #fff;
}

.report-btn-small {
  background: #1e1c2b;
  color: #ffa502;
  border: 1px solid rgba(255, 165, 2, 0.3);
  width: 42px;
  height: 42px;
  font-size: 16px;
}

/* SOHBET / İNBOX LİSTESİ */
.sub-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 14px;
}

.inbox-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.chat-item {
  display: flex;
  align-items: center;
  gap: 12px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  padding: 10px;
  border-radius: 14px;
  cursor: pointer;
  transition: background 0.2s;
}

.chat-item:hover {
  background: rgba(255, 255, 255, 0.06);
}

.chat-avatar-wrap {
  width: 50px;
  height: 50px;
  border-radius: 50%;
  overflow: hidden;
  border: 1.5px solid #d4af37;
  flex-shrink: 0;
}

.chat-avatar {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.chat-info {
  flex: 1;
  min-width: 0;
}

.chat-name {
  font-weight: 700;
  font-size: 14px;
  color: #fff;
  margin-bottom: 2px;
}

.chat-snippet {
  font-size: 12px;
  color: #999;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.chat-time {
  font-size: 10px;
  color: #666;
}

/* BİREBİR SOHBET ODASI */
.chat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 10px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  margin-bottom: 10px;
  gap: 8px;
}

.partner-meta h3 {
  font-size: 14px;
  color: #fff;
}

.status-indicator {
  font-size: 10px;
  color: #d4af37;
}

.paravan-pill, .report-chat-pill, .unmatch-pill {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(212, 175, 55, 0.3);
  color: #d4af37;
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 10px;
  cursor: pointer;
}

.unmatch-pill {
  color: #ff4757;
  border-color: rgba(255, 71, 87, 0.3);
}

.icebreakers-bar {
  display: flex;
  gap: 6px;
  overflow-x: auto;
  padding-bottom: 8px;
  margin-bottom: 8px;
}

.ice-btn {
  background: rgba(212, 175, 55, 0.1);
  border: 1px solid rgba(212, 175, 55, 0.25);
  color: #d4af37;
  padding: 5px 10px;
  border-radius: 14px;
  font-size: 11px;
  white-space: nowrap;
  cursor: pointer;
}

.chat-stream {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 4px;
  max-height: calc(100vh - 280px);
}

.chat-bubble {
  max-width: 75%;
  padding: 10px 14px;
  border-radius: 16px;
  font-size: 13px;
  position: relative;
  word-break: break-word;
}

.chat-bubble.me {
  background: linear-gradient(135deg, #d4af37, #b8972b);
  color: #0b0a10;
  align-self: flex-end;
  border-bottom-right-radius: 4px;
  font-weight: 500;
}

.chat-bubble.them {
  background: #201e30;
  color: #fff;
  align-self: flex-start;
  border-bottom-left-radius: 4px;
  border: 1px solid rgba(255, 255, 255, 0.06);
}

.bubble-time {
  font-size: 9px;
  display: block;
  text-align: right;
  margin-top: 4px;
  opacity: 0.7;
}

.chat-composer {
  display: flex;
  gap: 8px;
  padding-top: 10px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  margin-top: 8px;
}

.chat-composer input {
  flex: 1;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.12);
  padding: 10px 14px;
  border-radius: 20px;
  color: #fff;
  outline: none;
  font-size: 13px;
}

.composer-btn {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: #d4af37;
  color: #0b0a10;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
}

/* METAVERSE EKRANI İZOLASYONU */
#metaverseView {
  padding: 0 !important;
  position: relative !important;
  overflow: hidden !important;
  background: #0a0a0f !important;
  height: calc(100vh - 65px) !important;
}

#canvas-container {
  width: 100%;
  height: 100%;
  position: absolute;
  top: 0;
  left: 0;
  z-index: 10;
}

.metaverse-exit-btn {
  position: absolute;
  top: 16px;
  left: 16px;
  z-index: 50;
  background: rgba(14, 13, 23, 0.85);
  backdrop-filter: blur(12px);
  border: 1px solid #d4af37;
  color: #fff;
  padding: 8px 16px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}

#joystick-zone {
  position: absolute;
  bottom: 25px;
  left: 20px;
  width: 110px;
  height: 110px;
  z-index: 50;
  pointer-events: auto;
}

/* YT YÖNETİM MASASI */
.stats-cards {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 8px;
  margin-bottom: 14px;
}

.stat-pill {
  background: #171622;
  border: 1px solid rgba(212, 175, 55, 0.2);
  padding: 10px;
  border-radius: 12px;
  text-align: center;
}

.stat-pill span {
  font-size: 10px;
  color: #888;
}

.stat-pill strong {
  font-size: 16px;
  color: #d4af37;
}

.admin-action-box {
  border: 1.5px solid rgba(212, 175, 55, 0.4);
  background: rgba(22, 22, 34, 0.7);
  border-radius: 14px;
  padding: 12px;
  margin-bottom: 14px;
}

.admin-user-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #171622;
  padding: 10px;
  border-radius: 12px;
  margin-bottom: 6px;
  font-size: 12px;
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.modal-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.8);
  backdrop-filter: blur(8px);
  z-index: 200;
  display: flex;
  align-items: flex-end;
}

.modal-sheet {
  width: 100%;
  background: #171622;
  border-top: 1px solid rgba(212, 175, 55, 0.35);
  border-radius: 24px 24px 0 0;
  padding: 20px;
  max-height: 80vh;
  overflow-y: auto;
}

.sheet-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 14px;
}

.icon-close {
  background: none;
  border: none;
  color: #aaa;
  font-size: 18px;
  cursor: pointer;
}
