import { useEffect } from 'react';
import { RouterProvider } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import arEG from 'antd/locale/ar_EG';
import { router } from '@/router';
import { useAuthStore } from '@/lib/auth';

export default function App() {
  const loadFromStorage = useAuthStore((s) => s.loadFromStorage);

  useEffect(() => {
    loadFromStorage();
  }, [loadFromStorage]);

  return (
    <ConfigProvider
      direction="rtl"
      locale={arEG}
      theme={{
        token: {
          colorPrimary: '#1677ff',
          borderRadius: 6,
          fontFamily: "'Segoe UI', Tahoma, Arial, sans-serif",
        },
      }}
    >
      <RouterProvider router={router} />
    </ConfigProvider>
  );
}
