import Link from 'next/link'

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-white">
      <div className="flex flex-col lg:flex-row">
        {/* Title Section - Top on mobile, Left sidebar on desktop */}
        <div className="w-full lg:w-1/3 lg:fixed lg:h-screen bg-gray-50">
          <div className="px-6 py-8 lg:h-full lg:flex lg:flex-col lg:justify-center lg:px-16">
            <div className="lg:max-w-lg">
              <Link href="/">
                <h1 className="text-4xl md:text-5xl lg:text-8xl font-normal text-gray-900 tracking-tight mb-4 lg:mb-8">
                  Mayo
                  <br />
                  Rocks
                </h1>
              </Link>
              <p className="text-xl lg:text-2xl text-gray-600 font-light">Topics about Life and Technology</p>
            </div>

            {/* Archive Links */}
            <div className="mt-8 lg:mt-16">
              <div className="flex gap-4">Licensed by CC-BY-SA 4.0</div>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="w-full lg:w-2/3 lg:ml-auto">
          <div className="px-6 md:px-12 lg:px-16 py-12 lg:py-24">
            <div className="space-y-16 lg:space-y-24">{children}</div>
          </div>
        </div>
      </div>
    </main>
  )
}
