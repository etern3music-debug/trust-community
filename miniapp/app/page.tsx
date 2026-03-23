'use client';

import { useEffect, useState } from 'react';

type RequestItem = {
  id: number;
  title: string;
  description: string | null;
  target_amount: number;
  current_amount: number;
  progress_percent: number;
  progress_bar: string;
};

const BACKEND_URL = 'https://trust-community-production-d22c.up.railway.app';

export default function HomePage() {
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadRequests() {
  try {
    console.log('BACKEND_URL:', BACKEND_URL);

    const res = await fetch(`${BACKEND_URL}/api/requests`);
    console.log('STATUS:', res.status);

    const text = await res.text();
    console.log('RAW RESPONSE:', text);

    const data = JSON.parse(text);
    setRequests(data);
  } catch (error) {
    console.error('ERRORE loadRequests:', error);
    setRequests([]);
  } finally {
    setLoading(false);
  }
}

  async function handleDonate(requestId: number) {
    try {
      const tg = (window as any).Telegram?.WebApp;
      const telegramUserId = tg?.initDataUnsafe?.user?.id;

      alert(`Telegram user id: ${telegramUserId}`);

      if (!telegramUserId) {
        alert('Errore: utente Telegram non trovato');
        return;
      }

      const userRes = await fetch(
        `${BACKEND_URL}/api/users/by-telegram/${telegramUserId}`
      );

      const user = await userRes.json();

      if (!userRes.ok) {
        alert('Utente non registrato nel sistema');
        return;
      }

      const res = await fetch(`${BACKEND_URL}/api/donations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          request_id: requestId,
          donor_user_id: user.id,
          amount: 5,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || 'Errore nella donazione');
        return;
      }

      alert('Donazione inviata!');
      await loadRequests();
    } catch (error) {
      console.error(error);
      alert('Errore nella donazione');
    }
  }

  useEffect(() => {
  const tg = (window as any).Telegram?.WebApp;
  if (tg) {
    tg.ready();
    tg.expand();
    console.log('Telegram WebApp trovato');
    console.log('initDataUnsafe:', tg.initDataUnsafe);
  } else {
    console.log('Telegram WebApp NON trovato');
  }

  loadRequests();
}, []);

  return (
    <main className="p-6">
      <h1 className="text-2xl font-bold mb-6">Richieste attive</h1>

      {loading ? (
        <p>Caricamento...</p>
      ) : requests.length === 0 ? (
        <p>Nessuna richiesta trovata.</p>
      ) : (
        <div className="space-y-4">
          {requests.map((request) => (
            <div key={request.id} className="border rounded-xl p-4 shadow-sm">
              <h2 className="text-lg font-semibold">{request.title}</h2>
              <p className="text-sm text-gray-600 mb-2">
                {request.description || 'Nessuna descrizione'}
              </p>
              <p className="font-medium">
                {request.current_amount}€ / {request.target_amount}€
              </p>
              <p>{request.progress_percent}%</p>
              <p className="font-mono">{request.progress_bar}</p>

              <button
                className="mt-3 bg-black text-white px-4 py-2 rounded"
                onClick={() => handleDonate(request.id)}
              >
                Dona 5€
              </button>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}