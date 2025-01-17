import Link from 'next/link'

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-white">
      <div className="flex">
        {/* Left Column - Fixed Title Section */}
        <div className="w-1/3 fixed h-screen bg-gray-50">
          <div className="h-full flex flex-col justify-center px-16">
            <div className="max-w-lg">
              <Link href="/">
                <h1 className="text-8xl font-normal text-gray-900 tracking-tight mb-8">
                  Mayo
                  <br />
                  Rocks
                </h1>
              </Link>
              <p className="text-2xl text-gray-600 font-light">Topics about Life and Technology</p>
            </div>

            {/* Archive Links */}
            <div className="mt-16">
              <div className="flex gap-4">Licensed by CC-BY-SA 4.0</div>
            </div>
          </div>
        </div>

        {/* Right Column - Scrollable Blog Posts */}
        <div className="w-2/3 ml-auto">
          <div className="px-16 py-24">
            <div className="space-y-24">{children}</div>
          </div>
        </div>
      </div>
    </main>
  )
}
