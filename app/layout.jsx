import './globals.css';

export const metadata = {
  title: 'To Do List Harian',
  description: 'Daftar tugas harian — sederhana, cepat, tersimpan di perangkatmu.',
  manifest: '/manifest.webmanifest',
};

export const viewport = {
  themeColor: '#ff6a00',
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
