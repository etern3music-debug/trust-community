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
  creator_name?: string;
  creator_username?: string | null;
  payment_link?: string | null;
  status?: string;
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

type DonationItem = {
  id: number;
  amount: number;
  status: string;
  created_at: string;
  request_id: number;
  request_title: string;
  request_description: string | null;
};

const BACKEND_URL = 'https://trust-community-production-d22c.up.railway.app';
const ADMIN_TELEGRAM_ID = 5311155297;

export default function HomePage() {
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(true);

  const [myRequests, setMyRequests] = useState<RequestItem[]>([]);
  const [loadingMyRequests, setLoadingMyRequests] = useState(true);

  const [me, setMe] = useState<MeData | null>(null);
  const [telegramAvailable, setTelegramAvailable] = useState(false);
  const [paymentLink, setPaymentLink] = useState('');

  const [amounts, setAmounts] = useState<Record<number, string>>({});
  const [myDonations, setMyDonations] = useState<DonationItem[]>([]);

  const [requestTitle, setRequestTitle] = useState('');
  const [requestDescription, setRequestDescription] = useState('');
  const [requestTarget, setRequestTarget] = useState('');

  const [pendingUsers, setPendingUsers] = useState<any[]>([]);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [isAdminUser, setIsAdminUser] = useState(false);
  const [approvedAdminRequests, setApprovedAdminRequests] = useState<any[]>([]);

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

  async function loadMyRequests(telegramUserId: number) {
    try {
      const res = await fetch(`${BACKEND_URL}/api/my-requests-by-telegram/${telegramUserId}`);
      const data = await res.json();

      if (res.ok) {
        setMyRequests(data);
      } else {
        setMyRequests([]);
      }
    } catch (error) {
      console.error('Errore caricamento mie richieste:', error);
      setMyRequests([]);
    } finally {
      setLoadingMyRequests(false);
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

  async function loadMyDonations(telegramUserId: number) {
    try {
      const res = await fetch(`${BACKEND_URL}/api/my-donations/${telegramUserId}`);
      const data = await res.json();

      if (res.ok) {
        setMyDonations(data);
      }
    } catch (error) {
      console.error('Errore caricamento donation:', error);
      setMyDonations([]);
    }
  }

  async function loadPendingUsers() {
    try {
      const res = await fetch(`${BACKEND_URL}/api/users/pending`);
      const data = await res.json();

      if (res.ok) {
        setPendingUsers(data);
      }
    } catch (error) {
      console.error('Errore caricamento utenti pending:', error);
      setPendingUsers([]);
    }
  }

  async function loadPendingRequests() {
    try {
      const res = await fetch(`${BACKEND_URL}/api/requests/pending`);
      const data = await res.json();

      if (res.ok) {
        setPendingRequests(data);
      }
    } catch (error) {
      console.error('Errore caricamento richieste pending:', error);
      setPendingRequests([]);
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

  async function loadApprovedAdminRequests() {
  try {
    const res = await fetch(`${BACKEND_URL}/api/requests/approved`);
    const data = await res.json();

    if (res.ok) {
      setApprovedAdminRequests(data);
    }
  } catch (error) {
    console.error('Errore caricamento richieste approvate:', error);
    setApprovedAdminRequests([]);
  }
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

      const userRes = await fetch(`${BACKEND_URL}/api/users/by-telegram/${telegramUserId}`);
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
      await loadMyDonations(telegramUserId);
      await loadMyRequests(telegramUserId);
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

      const userRes = await fetch(`${BACKEND_URL}/api/users/by-telegram/${telegramUserId}`);
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
      await loadMyRequests(telegramUserId);

      if (isAdminUser) {
        await loadPendingRequests();
      }
    } catch (error) {
      console.error(error);
      alert('Errore creazione richiesta');
    }
  }

  async function handleApproveUser(userId: number) {
    try {
      const res = await fetch(`${BACKEND_URL}/api/users/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId })
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || 'Errore approvazione utente');
        return;
      }

      alert('Utente approvato');
      await loadPendingUsers();
    } catch (error) {
      console.error(error);
      alert('Errore approvazione utente');
    }
  }

  async function handleBanUser(userId: number) {
    try {
      const res = await fetch(`${BACKEND_URL}/api/users/ban`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId })
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || 'Errore ban utente');
        return;
      }

      alert('Utente bannato');
      await loadPendingUsers();
    } catch (error) {
      console.error(error);
      alert('Errore ban utente');
    }
  }

  async function handleApproveRequest(requestId: number) {
    try {
      const res = await fetch(`${BACKEND_URL}/api/requests/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ request_id: requestId })
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || 'Errore approvazione richiesta');
        return;
      }

      alert('Richiesta approvata');
      await loadPendingRequests();
      await loadRequests();
    } catch (error) {
      console.error(error);
      alert('Errore approvazione richiesta');
    }
  }

  async function handleRejectRequest(requestId: number) {
    try {
      const res = await fetch(`${BACKEND_URL}/api/requests/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ request_id: requestId })
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || 'Errore rifiuto richiesta');
        return;
      }

      alert('Richiesta rifiutata');
      await loadPendingRequests();
    } catch (error) {
      console.error(error);
      alert('Errore rifiuto richiesta');
    }
  }

  async function handleDeleteRequest(requestId: number) {
  try {
    const res = await fetch(`${BACKEND_URL}/api/requests/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ request_id: requestId })
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.error || 'Errore eliminazione richiesta');
      return;
    }

    alert('Richiesta eliminata');
    await loadPendingRequests();
    await loadApprovedAdminRequests();
    await loadRequests();
  } catch (error) {
    console.error(error);
    alert('Errore eliminazione richiesta');
  }
}

  function renderRequestStatus(status?: string) {
    if (status === 'pending') return 'In attesa approvazione';
    if (status === 'approved') return 'Approvata';
    if (status === 'rejected') return 'Rifiutata';
    return status || 'N/A';
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

          if (telegramUser.id === ADMIN_TELEGRAM_ID) {
            setIsAdminUser(true);
          }

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
          await loadMyDonations(telegramUser.id);
          await loadMyRequests(telegramUser.id);

          if (telegramUser.id === ADMIN_TELEGRAM_ID) {
            await loadPendingUsers();
            await loadPendingRequests();
            await loadApprovedAdminRequests();
          }
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

      <section className="border rounded-xl p-4 shadow-sm">
        <h1 className="text-2xl font-bold mb-4">Le mie richieste</h1>

        {!telegramAvailable ? (
          <p>Apri la Mini App dentro Telegram per vedere le tue richieste.</p>
        ) : loadingMyRequests ? (
          <p>Caricamento richieste...</p>
        ) : myRequests.length === 0 ? (
          <p>Nessuna richiesta creata.</p>
        ) : (
          <div className="space-y-3">
            {myRequests.map((request) => (
              <div key={request.id} className="border rounded p-3">
                <p><strong>ID:</strong> {request.id}</p>
                <p><strong>Titolo:</strong> {request.title}</p>
                <p><strong>Descrizione:</strong> {request.description || 'Nessuna descrizione'}</p>
                <p><strong>Target:</strong> {request.target_amount}€</p>
                <p><strong>Raccolti:</strong> {request.current_amount}€</p>
                <p><strong>Stato:</strong> {renderRequestStatus(request.status)}</p>
                <p><strong>Progresso:</strong> {request.progress_percent}%</p>
                <p className="font-mono">{request.progress_bar}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="border rounded-xl p-4 shadow-sm">
        <h1 className="text-2xl font-bold mb-4">Le mie donation</h1>

        {!telegramAvailable ? (
          <p>Apri la Mini App dentro Telegram per vedere le tue donation.</p>
        ) : myDonations.length === 0 ? (
          <p>Nessuna donation registrata.</p>
        ) : (
          <div className="space-y-3">
            {myDonations.map((donation) => (
              <div key={donation.id} className="border rounded p-3">
                <p><strong>Donation ID:</strong> {donation.id}</p>
                <p><strong>Richiesta:</strong> {donation.request_title}</p>
                <p><strong>Importo:</strong> {donation.amount}€</p>
                <p>
                  <strong>Stato:</strong>{' '}
                  {donation.status === 'pending_receiver_confirmation'
                    ? 'In attesa conferma ricevente'
                    : donation.status === 'confirmed'
                    ? 'Confermata'
                    : donation.status}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      {isAdminUser && (
        <section className="border rounded-xl p-4 shadow-sm">
          <h1 className="text-2xl font-bold mb-4">Admin Panel</h1>

          <div className="mb-6">
            <h2 className="text-xl font-semibold mb-3">Utenti pending</h2>

            {pendingUsers.length === 0 ? (
              <p>Nessun utente pending.</p>
            ) : (
              <div className="space-y-3">
                {pendingUsers.map((user) => (
                  <div key={user.id} className="border rounded p-3">
                    <p><strong>ID:</strong> {user.id}</p>
                    <p><strong>Nome:</strong> {user.display_name}</p>
                    <p><strong>Username:</strong> {user.username || 'N/A'}</p>
                    <p><strong>Telegram ID:</strong> {user.telegram_user_id}</p>
                    <p><strong>Stato:</strong> {user.status}</p>

                    <div className="mt-3 flex gap-2">
                      <button
                        className="bg-green-600 text-white px-4 py-2 rounded"
                        onClick={() => handleApproveUser(user.id)}
                      >
                        Approva
                      </button>

                      <button
                        className="bg-red-600 text-white px-4 py-2 rounded"
                        onClick={() => handleBanUser(user.id)}
                      >
                        Banna
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <h2 className="text-xl font-semibold mb-3">Richieste pending</h2>

            {pendingRequests.length === 0 ? (
              <p>Nessuna richiesta pending.</p>
            ) : (
              <div className="space-y-3">
                {pendingRequests.map((request) => (
                  <div key={request.id} className="border rounded p-3">
                    <p><strong>ID:</strong> {request.id}</p>
                    <p><strong>Titolo:</strong> {request.title}</p>
                    <p><strong>Descrizione:</strong> {request.description || 'Nessuna descrizione'}</p>
                    <p><strong>Target:</strong> {request.target_amount}€</p>
                    <p><strong>Utente:</strong> {request.users?.display_name || 'Utente'}</p>
                    <p><strong>Stato:</strong> {request.status}</p>

                    <div className="mt-3 flex gap-2 flex-wrap">
                      <button
                        className="bg-green-600 text-white px-4 py-2 rounded"
                        onClick={() => handleApproveRequest(request.id)}
                      >
                        Approva richiesta
                      </button>

                      <button
                        className="bg-red-600 text-white px-4 py-2 rounded"
                        onClick={() => handleRejectRequest(request.id)}
                      >
                        Rifiuta richiesta
                      </button>
                      
                      <button
                        className="bg-gray-800 text-white px-4 py-2 rounded"
                        onClick={() => handleDeleteRequest(request.id)}
                     >
                        Elimina richiesta
                     </button>
                
                   </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="mt-6">
  <h2 className="text-xl font-semibold mb-3">Richieste approvate</h2>

  {approvedAdminRequests.length === 0 ? (
    <p>Nessuna richiesta approvata.</p>
  ) : (
    <div className="space-y-3">
      {approvedAdminRequests.map((request) => (
        <div key={request.id} className="border rounded p-3">
          <p><strong>ID:</strong> {request.id}</p>
          <p><strong>Titolo:</strong> {request.title}</p>
          <p><strong>Descrizione:</strong> {request.description || 'Nessuna descrizione'}</p>
          <p><strong>Target:</strong> {request.target_amount}€</p>
          <p><strong>Raccolti:</strong> {request.current_amount}€</p>
          <p><strong>Utente:</strong> {request.users?.display_name || 'Utente'}</p>
          <p><strong>Stato:</strong> {request.status}</p>

          <div className="mt-3 flex gap-2">
            <button
              className="bg-gray-800 text-white px-4 py-2 rounded"
              onClick={() => handleDeleteRequest(request.id)}
            >
              Elimina richiesta
            </button>
          </div>
        </div>
      ))}
    </div>
  )}
</div>
        </section>
      )}

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