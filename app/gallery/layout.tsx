// app/gallery/layout.tsx
export const revalidate = 300;

export default function GalleryLayout({ children }: { children: React.ReactNode }) {
  return <div className="w-full">{children}</div>;
}
