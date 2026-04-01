'use client';
import BlueChipTrends from '../components/BlueChipTrends';

export default function TrendsPage() {
  return (
    <div className="app-container trends-page">
      <main className="content" style={{ width: '100%', maxWidth: '1200px', margin: '0 auto' }}>
        <BlueChipTrends />
      </main>
    </div>
  );
}
