const tg = window.Telegram?.WebApp;
if (tg) {
  tg.ready();
  tg.expand();
}

const tgUser = tg?.initDataUnsafe?.user;
const telegramId = tgUser ? tgUser.id : null;
const username = tgUser ? tgUser.username : null;

let selectedSlot = null;
const images = [null, null, null, null];

function pickImage(slotIndex) {
  selectedSlot = slotIndex;
  document.getElementById('fileSelector').click();
}

function onFileSelected(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    const base64Data = e.target.result;
    images[selectedSlot] = base64Data;

    const slotElem = document.getElementById(`slot-${selectedSlot}`);
    const imgElem = slotElem.querySelector('.slot-preview');
    const iconElem = slotElem.querySelector('.slot-icon');

    imgElem.src = base64Data;
    imgElem.style.display = 'block';
    iconElem.style.display = 'none';
  };
  reader.readAsDataURL(file);
}

async function handleFormSubmit(e) {
  e.preventDefault();

  if (!images[0]) {
    alert('Lütfen en az bir ana fotoğraf yükleyin.');
    return;
  }

  const payload = {
    telegramId: telegramId || 999999999,
    username: username || '',
    nickname: document.getElementById('nickname').value,
    age: document.getElementById('age').value,
    height: document.getElementById('height').value,
    weight: document.getElementById('weight').value,
    role: document.getElementById('role').value,
    expression: document.getElementById('expression').value,
    bio: document.getElementById('bio').value,
    photos: images.filter(img => img !== null)
  };

  const btn = document.getElementById('saveBtn');
  btn.disabled = true;
  btn.innerText = 'Kaydediliyor...';

  try {
    const res = await fetch('/api/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (data.success) {
      if (tg?.showPopup) {
        tg.showPopup({ title: 'Tebrikler!', message: 'Profilin oluşturuldu.', buttons: [{ type: 'ok' }] }, () => {
          tg.close();
        });
      } else {
        alert('Profil başarıyla oluşturuldu!');
      }
    } else {
      alert(data.message || 'Bir hata oluştu.');
      btn.disabled = false;
      btn.innerText = 'Profili Kaydet';
    }
  } catch (err) {
    console.error(err);
    alert('Sunucuya bağlanılamadı.');
    btn.disabled = false;
    btn.innerText = 'Profili Kaydet';
  }
}
