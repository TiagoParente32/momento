import { useState } from 'react';
import { Search } from 'lucide-react';

export default function SearchWidget() {
  const [q, setQ] = useState('');
  const submit = () => {
    const query = q.trim();
    if (!query) return;
    // chrome.search uses the user's default search engine (needs "search" permission); fall back to Google.
    const anyChrome = (globalThis as any).chrome;
    if (anyChrome?.search?.query) anyChrome.search.query({ text: query, disposition: 'CURRENT_TAB' });
    else location.href = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
  };
  return (
    <form className="glass flex w-[min(28rem,80vw)] items-center gap-2 rounded-full px-4 py-2" onSubmit={(e) => { e.preventDefault(); submit(); }}>
      <Search className="h-4 w-4 text-white/70" />
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search the web" className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/60" aria-label="Search the web" />
    </form>
  );
}
