import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'DEADSHIFT — Quarantine Zone',
  description:
    'Survive 6 waves of infected in a nocturnal industrial complex. 3D Zombie Survival FPS.',
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
