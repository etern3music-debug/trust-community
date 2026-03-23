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
  creator_name: string;
  creator_username: string | null;
  payment_link: string | null;
};

const BACKEND_URL = 'https://trust-community-production-d22c.up.railway.app';

export default function HomePage() {
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadRequests() {
    try {
      const res = await fetch(`${BACKEND_URL}/api/requests`);
      const data = await res.json();
      setRequests(data);
    } catch (error) {
      console.error('Errore caricamento richieste:', error);
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }

  function handlePay(request: RequestItem) {
    if (!request.payment_link) {
      alert('Metodo di pagamento non disponibile');
      return;
    }

    window.open(request.payment_link, '_blank');
  }

  async function handleConfirm(requestId: number) {
    try {
      const tg = (window as any).Telegram?.WebApp;
      const telegramUserId = tg?.initDataUnsafe?.user?.id;

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
        alert(data.error || 'Errore nella registrazione della donazione');
        return;
      }

      alert('Donazione registrata!');
      await loadRequests();
    } catch (error) {
      console.error(error);
      alert('Errore nella donazione');
    }
  }

  useEffect(() => {
    async function initTelegramUser() {
      try {
        const tg = (window as any).Telegram?.WebApp;
        if (tg) {
          tg.ready();
          tg.expand();

          const telegramUser = tg?.initDataUnsafe?.user;

          if (telegramUser?.id) {
            await fetch(`${BACKEND_URL}/api/users/ensure`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                telegram_user_id: telegramUser.id,
                username: telegramUser.username || null,
                display_name: telegramUser.first_name || 'Nuovo utente'
              }),
            });
          }
        }

        await loadRequests();
      } catch (error) {
        console.error('Errore init utente Telegram:', error);
        await loadRequests();
      }
    }

    initTelegramUser();
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
              <p className="text-sm mb-2">
                Creatore: {request.creator_name}
              </p>
              <p className="font-medium">
                {request.current_amount}€ / {request.target_amount}€
              </p>
              <p>{request.progress_percent}%</p>
              <p className="font-mono">{request.progress_bar}</p>

              <button
                className="mt-3 bg-green-600 text-white px-4 py-2 rounded"
                onClick={() => handlePay(request)}
              >
                Paga 5€
              </button>

              <button
                className="mt-2 ml-2 bg-blue-600 text-white px-4 py-2 rounded"
                onClick={() => handleConfirm(request.id)}
              >
                Ho pagato
              </button>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}