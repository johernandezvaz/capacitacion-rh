'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function DeteccionDetailRedirect() {
    const router = useRouter();
    useEffect(() => { router.replace('/detecciones'); }, []);
    return null;
}
