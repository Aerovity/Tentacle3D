import Image from "next/image"
import Link from "next/link"
import { Sparkles } from "lucide-react"

export function Header() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-black/30 backdrop-blur-md p-4 flex items-center justify-between text-white">
      <div className="flex items-center space-x-4">
        <Link href="/" className="flex items-center space-x-2">
          <Image src="/tentacle3d-logo.png" alt="Tentacle3D Logo" width={40} height={40} className="rounded-full" />
          <span className="text-xl font-bold">TENTACLE3D</span>
        </Link>
        <nav className="hidden md:flex items-center space-x-6">
          <Link
            href="#"
            className="flex items-center px-3 py-2 rounded-md text-sm font-medium bg-gradient-to-r from-blue-800 to-blue-950 text-white shadow-lg"
          >
            <Sparkles className="mr-2 h-4 w-4" />
            Generation
          </Link>
        </nav>
      </div>
      <div className="flex items-center space-x-4">
        {/* Placeholder for user/settings icons if needed later */}
        {/* <Button variant="ghost" size="icon">
          <Bell className="h-5 w-5" />
        </Button>
        <Button variant="ghost" size="icon">
          <Settings className="h-5 w-5" />
        </Button>
        <Avatar>
          <AvatarFallback>CN</AvatarFallback>
        </Avatar> */}
      </div>
    </header>
  )
}
