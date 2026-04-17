import { NextResponse, type NextRequest } from 'next/server'

// マルチテナント未有効化のため認証チェックをスキップ
// 有効化時にこのファイルを元に戻す
export async function proxy(request: NextRequest) {
  return NextResponse.next({ request })
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|exercises/.*\\.png|.*\\.svg).*)',
  ],
}
