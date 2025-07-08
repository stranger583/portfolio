import Link from "next/link";

export default function Home() {
  return ( 
    <div className="flex flex-col items-center justify-center h-screen">
      <Link className="text-blue-500" href="/cryptoPanel">Crypto Panel</Link>
      <Link className="text-blue-500" href="/chatSystem">Chat System</Link>
      <Link className="text-blue-500" href="/collaborativeEditor">Collaborative Editor</Link>
    </div>
  );
}
