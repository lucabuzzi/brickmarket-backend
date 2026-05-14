import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

export const THEMES = [
  { name: 'Star Wars', img: 'https://picsum.photos/seed/theme-sw/150/150' },
  { name: 'Technic', img: 'https://picsum.photos/seed/theme-tech/150/150' },
  { name: 'Harry Potter', img: 'https://picsum.photos/seed/theme-hp/150/150' },
  { name: 'Ninjago', img: 'https://picsum.photos/seed/theme-nj/150/150' },
  { name: 'Icons', img: 'https://picsum.photos/seed/theme-icons/150/150' },
];

export const CATEGORIES = [
  { name: 'Set', slug: 'sets', img: 'https://picsum.photos/seed/cat-sets/150/150' },
  { name: 'MOCs', slug: 'mocs', img: 'https://picsum.photos/seed/cat-mocs/150/150' },
  { name: 'Minifigures', slug: 'minifigures', img: 'https://picsum.photos/seed/cat-mini/150/150' },
];

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();

  const handleThemeClick = (themeName) => {
    navigate(`/search-results?q=${encodeURIComponent(themeName)}`);
  };

  const handleCategoryClick = (slug) => {
    navigate(`/category/${slug}`);
  };

  return (
    <aside className="hidden md:flex flex-col w-[172px] shrink-0 gap-7 border-r border-[#1f2937] pr-3">
      <section>
        <h2 className="text-[12px] font-bold text-slate-500 uppercase tracking-[2.2px] mb-3">
          Categorie
        </h2>

        <div className="flex flex-col gap-1.5">
          {CATEGORIES.map((cat, idx) => {
            const isActive = location.pathname === `/category/${cat.slug}`;

            return (
              <button
                key={idx}
                onClick={() => handleCategoryClick(cat.slug)}
                className={`flex items-center gap-2.5 p-1.5 rounded-lg transition-colors text-left ${isActive
                    ? 'bg-sky-500/10 text-sky-400'
                    : 'text-slate-300 hover:bg-slate-800'
                  }`}
              >
                <div
                  className={`w-6 h-6 rounded-full overflow-hidden border shrink-0 ${isActive ? 'border-sky-500' : 'border-[#1f2937]'
                    }`}
                >
                  <img src={cat.img} alt={cat.name} className="w-full h-full object-cover" />
                </div>

                <span className="text-[13px] font-semibold truncate leading-none">
                  {cat.name}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="text-[12px] font-bold text-slate-500 uppercase tracking-[2.2px] mb-3">
          Temi Popolari
        </h2>

        <div className="flex flex-col gap-1.5">
          {THEMES.map((theme, idx) => (
            <button
              key={idx}
              onClick={() => handleThemeClick(theme.name)}
              className="flex items-center gap-2.5 p-1.5 rounded-lg text-slate-300 hover:bg-slate-800 transition-colors text-left"
            >
              <div className="w-6 h-6 rounded-full overflow-hidden border border-[#1f2937] shrink-0">
                <img src={theme.img} alt={theme.name} className="w-full h-full object-cover" />
              </div>

              <span className="text-[13px] font-semibold truncate leading-none">
                {theme.name}
              </span>
            </button>
          ))}
        </div>
      </section>
    </aside>
  );
}