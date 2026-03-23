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

type MeData = {
  user: {
    id: number;
    display_name: string;
    username: string | null;
    status: string;
    score: number;
    level: number;
    payment_link: string | null;
  };
  stats: {
    total_badges: number;
    total_donations: number;
    total_donated_amount: number;
    total_requests: number;
  };
  badges: { badge: string }[];
};

const BACKEND_URL = 'https://trust-community-production-d22c.up.railway.app';

export default function HomePage() {
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(true);

  const [me, setMe] = useState<MeData | null>(null);
  const [telegramAvailable, setTelegramAvailable] = useState(false);
  const [paymentLink, setPaymentLink] = useState('');

  const [amounts, setAmounts] = useState<Record<number, string>>({});

  const [requestTitle, setRequestTitle] = useState('');
  const [requestDescription, setRequestDescription] = useState('');
  const [requestTarget, setRequestTarget] = useState('');

  async function loadRequests() {
    try {
      const res = await fetch(`${BACKEND_URL}/api/requests`);
      const data = await res.json();
      setRequests(data);
    } catch (error) {
      console.error('Errore caricamento richieste:', error);
      setRequests([]);
    } finally {
      setLoadingRequests(false);
    }
  }

  async function loadMe(telegramUserId: number) {
    try {
      const res = await fetch(`${BACKEND_URL}/api/me/${telegramUserId}`);
      const data = await res.json();

      if (res.ok) {
        setMe(data);
        setPaymentLink(data.user.payment_link || '');
      }
    } catch (error) {
      console.error('Errore caricamento profilo:', error);
    }
  }

  function getAmountForRequest(requestId: number) {
    return Number(amounts[requestId]);
  }

  function handleAmountChange(requestId: number, value: string) {
    setAmounts((prev) => ({
      ...prev,
      [requestId]: value
    }));
  }

  function handlePay(request: RequestItem) {
    const amount = getAmountForRequest(request.id);

    if (!amount || amount <= 0) {
      alert('Inserisci un importo valido');
      return;
    }

    if (!request.payment_link) {
      alert('Metodo di pagamento non disponibile');
      return;
    }

    let paymentUrl = request.payment_link;

    if (paymentUrl.includes('paypal.me')) {
      paymentUrl = `${paymentUrl.replace(/\/$/, '')}/${amount}`;
    }

    window.open(paymentUrl, '_blank');
  }

  async function handleConfirm(requestId: number) {
    try {
      const amount = getAmountForRequest(requestId);

      if (!amount || amount <= 0) {
        alert('Inserisci un importo valido prima di confermare');
        return;
      }

      const tg = (window as any).Telegram?.WebApp;
      const telegramUserId = tg?.initDataUnsafe?.user?.id;

      if (!telegramUserId) {
        alert('Apri la Mini App dentro Telegram per confermare il pagamento');
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
          amount
        })
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || 'Errore nella registrazione della donazione');
        return;
      }

      alert(data.message || 'Pagamento segnalato con successo');
      await loadRequests();
      await loadMe(telegramUserId);
    } catch (error) {
      console.error(error);
      alert('Errore nella donazione');
    }
  }

  async function handleSavePaymentLink() {
    try {
      const tg = (window as any).Telegram?.WebApp;
      const telegramUserId = tg?.initDataUnsafe?.user?.id;

      if (!telegramUserId) {
        alert('Apri la Mini App dentro Telegram per salvare il payment link');
        return;
      }

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
        alert(data.error || 'Errore salvataggio payment link');
        return;
      }

      alert('Payment link salvato!');
      await loadMe(telegramUserId);
      await loadRequests();
    } catch (error) {
      console.error(error);
      alert('Errore salvataggio payment link');
    }
  }

  async function handleCreateRequest() {
    try {
      const tg = (window as any).Telegram?.WebApp;
      const telegramUserId = tg?.initDataUnsafe?.user?.id;

      if (!telegramUserId) {
        alert('Apri la Mini App dentro Telegram per creare richieste');
        return;
      }

      if (!requestTitle || !requestTarget) {
        alert('Titolo e importo target sono obbligatori');
        return;
      }

      const userRes = await fetch(
        `${BACKEND_URL}/api/users/by-telegram/${telegramUserId}`
      );

      const user = await userRes.json();

      if (!userRes.ok) {
        alert('Utente non registrato');
        return;
      }

      const res = await fetch(`${BACKEND_URL}/api/requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          title: requestTitle,
          description: requestDescription,
          target_amount: Number(requestTarget)
        })
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || 'Errore creazione richiesta');
        return;
      }

      alert('Richiesta inviata! In attesa di approvazione admin.');

      setRequestTitle('');
      setRequestDescription('');
      setRequestTarget('');

      await loadMe(telegramUserId);
      await loadRequests();
    } catch (error) {
      console.error(error);
      alert('Errore creazione richiesta');
    }
  }

  useEffect(() => {
    async function init() {
      try {
        const tg = (window as any).Telegram?.WebApp;
        const telegramUser = tg?.initDataUnsafe?.user;

        if (tg && telegramUser?.id) {
          setTelegramAvailable(true);
          tg.ready();
          tg.expand();

          await fetch(`${BACKEND_URL}/api/users/ensure`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              telegram_user_id: telegramUser.id,
              username: telegramUser.username || null,
              display_name: telegramUser.first_name || 'Nuovo utente'
            })
          });

          await loadMe(telegramUser.id);
        } else {
          setTelegramAvailable(false);
        }

        await loadRequests();
      } catch (error) {
        console.error('Errore init Mini App:', error);
        await loadRequests();
      }
    }

    init();
  }, []);

  return (
    <main className="p-6 space-y-6">
      <section className="border rounded-xl p-4 shadow-sm">
        <h1 className="text-2xl font-bold mb-4">Profilo</h1>

        {!telegramAvailable ? (
          <p>Apri la Mini App dentro Telegram per vedere il tuo profilo.</p>
        ) : !me ? (
          <p>Caricamento profilo...</p>
        ) : (
          <div className="space-y-2">
            <p><strong>Nome:</strong> {me.user.display_name}</p>
            <p><strong>Username:</strong> {me.user.username || 'N/A'}</p>
            <p><strong>Stato:</strong> {me.user.status}</p>
            <p><strong>Score:</strong> {me.user.score}</p>
            <p><strong>Livello:</strong> {me.user.level}</p>
            <p><strong>Badge:</strong> {me.badges.map((b) => b.badge).join(', ') || 'Nessuno'}</p>
            <p><strong>Totale donato:</strong> {me.stats.total_donated_amount}€</p>
            <p><strong>Richieste create:</strong> {me.stats.total_requests}</p>

            <div className="pt-3">
              <label className="block mb-2 font-medium">Payment link</label>
              <input
                type="text"
                value={paymentLink}
                onChange={(e) => setPaymentLink(e.target.value)}
                placeholder="https://paypal.me/tuonome"
                className="border rounded px-3 py-2 w-full"
              />
              <button
                className="mt-3 bg-black text-white px-4 py-2 rounded"
                onClick={handleSavePaymentLink}
              >
                Salva payment link
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="border rounded-xl p-4 shadow-sm">
        <h1 className="text-2xl font-bold mb-4">Crea richiesta</h1>

        <input
          type="text"
          value={requestTitle}
          onChange={(e) => setRequestTitle(e.target.value)}
          placeholder="Titolo richiesta"
          className="border rounded px-3 py-2 w-full mb-3"
        />

        <textarea
          value={requestDescription}
          onChange={(e) => setRequestDescription(e.target.value)}
          placeholder="Descrizione"
          className="border rounded px-3 py-2 w-full mb-3"
        />

        <input
          type="number"
          min="1"
          step="1"
          value={requestTarget}
          onChange={(e) => setRequestTarget(e.target.value)}
          placeholder="Importo target"
          className="border rounded px-3 py-2 w-full mb-3"
        />

        <button
          className="bg-purple-600 text-white px-4 py-2 rounded"
          onClick={handleCreateRequest}
        >
          Invia richiesta
        </button>
      </section>

      <section>
        <h1 className="text-2xl font-bold mb-6">Richieste attive</h1>

        {loadingRequests ? (
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

                <input
                  type="number"
                  min="1"
                  step="1"
                  placeholder="Importo"
                  value={amounts[request.id] || ''}
                  onChange={(e) => handleAmountChange(request.id, e.target.value)}
                  className="mt-3 border rounded px-3 py-2 w-full"
                />

                <div className="mt-3 flex gap-2">
                  <button
                    className="bg-green-600 text-white px-4 py-2 rounded"
                    onClick={() => handlePay(request)}
                  >
                    Paga
                  </button>

                  <button
                    className="bg-blue-600 text-white px-4 py-2 rounded"
                    onClick={() => handleConfirm(request.id)}
                  >
                    Ho pagato
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}