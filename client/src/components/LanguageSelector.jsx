import React from 'react';
import { useLanguage } from '../LanguageContext';

function LanguageSelector() {
  const { language, setLanguage } = useLanguage();

  return (
    <div className="flex gap-1">
      {['en', 'az', 'ru'].map(lang => (
        <button
          key={lang}
          onClick={() => setLanguage(lang)}
          className={`px-2 py-1 rounded text-xs font-bold uppercase transition ${
            language === lang
              ? 'bg-bp-green text-white'
              : 'bg-gray-700 text-gray-400 hover:text-white'
          }`}
        >
          {lang}
        </button>
      ))}
    </div>
  );
}

export default LanguageSelector;