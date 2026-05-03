import React, { useState, useEffect } from 'react';
import Login from './components/Login';
import Register from './components/Register';
import Chat from './components/Chat';

function App() {
  const [page, setPage] = useState('login');
  const [user, setUser] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    if (token && savedUser) {
      setUser(JSON.parse(savedUser));
      setPage('chat');
    }
  }, []);

  const handleLogin = (userData, token) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
    setPage('chat');
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    setPage('login');
  };

  return (
    <div>
      {page === 'login' && (
        <Login
          onLogin={handleLogin}
          onGoRegister={() => setPage('register')}
        />
      )}
      {page === 'register' && (
        <Register
          onGoLogin={() => setPage('login')}
        />
      )}
      {page === 'chat' && (
        <Chat
          user={user}
          onLogout={handleLogout}
        />
      )}
    </div>
  );
}

export default App;