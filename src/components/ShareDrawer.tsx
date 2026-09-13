"use client";

import { useEffect } from "react";
import Image from "next/image";

interface ShareDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  url: string;
  title: string;
  thumbnail: string;
}

export default function ShareDrawer({ isOpen, onClose, url, title, thumbnail }: ShareDrawerProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  if (!isOpen) return null;

  const text = `Watch "${title}" on Campus Movie Series!`;
  const encodedText = encodeURIComponent(text + "\n\n" + url);
  const encodedUrl = encodeURIComponent(url);

  const copyToClipboard = () => {
    try {
      const textArea = document.createElement("textarea");
      textArea.value = url;
      textArea.style.position = "fixed";
      textArea.style.left = "-9999px";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      alert("Link copied to clipboard!");
    } catch (e) {
      alert("Failed to copy link");
    }
    onClose();
  };

  const socials = [
    {
      name: "WhatsApp",
      color: "bg-[#25D366]",
      link: `https://wa.me/?text=${encodedText}`,
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.888-.788-1.487-1.761-1.66-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/>
        </svg>
      )
    },
    {
      name: "Twitter",
      color: "bg-black",
      link: `https://twitter.com/intent/tweet?text=${encodedText}`,
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
        </svg>
      )
    },
    {
      name: "Facebook",
      color: "bg-[#1877F2]",
      link: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.469h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.469h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
        </svg>
      )
    }
  ];

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-[100] transition-opacity" onClick={onClose} />
      
      <div className="fixed bottom-0 left-0 right-0 bg-[#1c1c1e] z-[101] rounded-t-2xl p-5 pb-10 shadow-2xl animate-in slide-in-from-bottom duration-300">
        <div className="flex justify-between items-center mb-5">
          <h3 className="font-semibold text-lg">Share Video</h3>
          <button onClick={onClose} className="p-2 bg-white/10 rounded-full active:scale-90 transition-transform">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <div className="flex items-center gap-4 bg-white/5 p-3 rounded-xl mb-6">
          <div className="relative w-24 aspect-video rounded-md overflow-hidden shrink-0 bg-black">
            <Image src={thumbnail} alt="Thumbnail" fill className="object-cover" />
          </div>
          <p className="text-sm font-medium line-clamp-2">{title}</p>
        </div>

        <div className="flex items-center justify-around mb-6">
          {socials.map(social => (
            <a key={social.name} href={social.link} target="_blank" rel="noopener noreferrer" onClick={onClose} className="flex flex-col items-center gap-2 active:scale-95 transition-transform">
              <div className={`w-14 h-14 rounded-full flex items-center justify-center ${social.color}`}>
                {social.icon}
              </div>
              <span className="text-xs text-white/80">{social.name}</span>
            </a>
          ))}
          
          <button onClick={copyToClipboard} className="flex flex-col items-center gap-2 active:scale-95 transition-transform">
            <div className="w-14 h-14 rounded-full flex items-center justify-center bg-white/20">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
            </div>
            <span className="text-xs text-white/80">Copy Link</span>
          </button>
        </div>
      </div>
    </>
  );
}
