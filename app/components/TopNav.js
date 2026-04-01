'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function TopNav() {
  const pathname = usePathname();

  return (
    <nav className="global-nav">
      <div className="nav-container">
        <Link 
          href="/" 
          className={`nav-link ${pathname === '/' ? 'active' : ''}`}
        >
          부동산 API 탐색기
        </Link>
        <Link
          href="/trends"
          className={`nav-link ${pathname === '/trends' ? 'active' : ''}`}
        >
          🔥 대장아파트 시세 트렌드
        </Link>
        <Link
          href="/predict"
          className={`nav-link ${pathname === '/predict' ? 'active' : ''}`}
        >
          📈 Next-Step 예측
        </Link>
      </div>
    </nav>
  );
}
