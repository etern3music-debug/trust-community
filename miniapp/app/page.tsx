'use client';

import { useEffect, useState } from 'react';

const BACKEND_URL = 'https://trust-community-production-d22c.up.railway.app';

export default function HomePage() {
  const [me, setMe] = useState<any>(null);
  const [requests, setRequests] = useState<any[]>([]);
  const [paymentLink, setPaymentLink] = useState('');
  const [amounts, setAmounts] = useState<any>({});

  async function loadRequests() {
    const res = await fetch(`${BACKEND_URL}/api/requests`);
    const data = await res.json();
    setRequests(data);
  }

  async function loadMe(telegramId: number) {
    const res = await fetch(`${BACKEND_URL}/api/me/${telegramId}`);
    const data = await res.json();

    if (res.ok) {
      setMe(data);
      setPaymentLink(data.user.payment_link || '');
    }
  }

  function handleAmountChange(id: number, value: string) {
    setAmounts((prev: any) => ({
      ...prev,
      [id]: value
    }));
  }

  function handlePay(request: any) {
    const amount = Number(amounts[request.id]);

    if (!amount || amount <= 0) {
      alert('Inserisci importo valido');
      return;
    }

    if (!request.payment_link) {
      alert('Pagamento non disponibile');
      return;
    }

    let url = request.payment_link;

    if (url.includes('paypal.me')) {
      url = `${url.replace(/\/$/, '')}/${amount}`;
    }

    window.open(url, '_blank');
  }

  async function handleConfirm(requestId: number) {
    const amount = Number(amounts[requestId]);

    if (!amount || amount <= 0) {
      alert('Inserisci importo valido');
      return;
    }

    const tg = (window as any).Telegram?.WebApp;
    const telegramUserId = tg?.initDataUnsafe?.user?.id;

    const userRes = await fetch(`${BACKEND_URL}/api/users/by-telegram/${telegramUserId}`);
    const user = await userRes.json();

    const res = await fetch(`${BACKEND_URL}/api/donations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        request_id: requestId,
        donor_user_id: user.id,
        amount
      })
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.error);
      return;
    }

    alert('Donazione registrata');

    await loadRequests();
    await loadMe(telegramUserId);
  }

  async function savePaymentLink() {
    const tg = (window as any).Telegram?.WebApp;
    const telegramUserId = tg?.initDataUnsafe?.user?.id;

    const res = await fetch(`${BACKEND_URL}/api/users/payment-link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        telegram_user_id: telegramUserId,
        payment_link: paymentLink
      })
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.error);
      return;
    }

    alert('Salvato');
    await loadMe(telegramUserId);
  }

  useEffect(() => {
    async function init() {
      const tg = (window as any).Telegram?.WebApp;
      const user = tg?.initDataUnsafe?.user;

      if (user?.id) {
        await fetch(`${BACKEND_URL}/api/users/ensure`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            telegram_user_id: user.id,
            username: user.username,
            display_name: user.first_name
          })
        });

        await loadMe(user.id);
      }

      await loadRequests();
    }

    init();
  }, []);

  return (
    <main className="p-6 space-y-6">

      {/* PROFILO */}
      <div className="border p-4 rounded">
        <h2 className="text-xl font-bold mb-3">Profilo</h2>

        {!me ? (
          <p>Caricamento...</p>
        ) : (
          <>
            <p>Nome: {me.user.display_name}</p>
            <p>Stato: {me.user.status}</p>
            <p>Score: {me.user.score}</p>
            <p>Livello: {me.user.level}</p>
            <p>Donato: {me.stats.total_donated_amount}€</p>

            <input
              className="mt-3 border p-2 w-full"
              placeholder="https://paypal.me/tuonome"
              value={paymentLink}
              onChange={(e) => setPaymentLink(e.target.value)}
            />

            <button
              className="mt-2 bg-black text-white px-4 py-2"
              onClick={savePaymentLink}
            >
              Salva link pagamento
            </button>
          </>
        )}
      </div>

      {/* REQUESTS */}
      <div>
        <h2 className="text-xl font-bold mb-3">Richieste</h2>

        {requests.map((r) => (
          <div key={r.id} className="border p-4 mb-3 rounded">
            <h3>{r.title}</h3>
            <p>{r.description}</p>

            <p>{r.current_amount}€ / {r.target_amount}€</p>
            <p>{r.progress_bar}</p>

            <input
              className="mt-2 border p-2 w-full"
              placeholder="Importo"
              onChange={(e) => handleAmountChange(r.id, e.target.value)}
            />

            <div className="flex gap-2 mt-2">
              <button
                className="bg-green-600 text-white px-3 py-2"
                onClick={() => handlePay(r)}
              >
                Paga
              </button>

              <button
                className="bg-blue-600 text-white px-3 py-2"
                onClick={() => handleConfirm(r.id)}
              >
                Ho pagato
              </button>
            </div>
          </div>
        ))}
      </div>

    </main>
  );
}