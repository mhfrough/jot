// Builds the signed Android app on Windows without Developer Mode.
// `tauri android build` compiles the Rust library and then links it into jniLibs with a symlink,
// which Windows refuses outside Developer Mode. So this lets Tauri compile each target, copies the
// library in place of the link, and runs Gradle itself without the tasks that call back into Tauri.
//   node tools/android-local.mjs [aarch64] [armv7] [i686] [x86_64]     (aarch64 when none given)
// Needs JAVA_HOME, ANDROID_HOME and NDK_HOME, the Rust Android targets, native/ui synced
// (npm run sync), and native/src-tauri/gen/android/keystore.properties to sign the release.
import { copyFileSync, existsSync, mkdirSync, rmSync, statSync, writeFileSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const native = join(root, 'native')
const tauri = join(native, 'src-tauri')
const android = join(tauri, 'gen/android')
const win = process.platform === 'win32'

// Tauri's target name, Rust's target triple, the Android ABI and Gradle's arch name
const TARGETS = {
  aarch64: ['aarch64-linux-android', 'arm64-v8a', 'arm64'],
  armv7: ['armv7-linux-androideabi', 'armeabi-v7a', 'arm'],
  i686: ['i686-linux-android', 'x86', 'x86'],
  x86_64: ['x86_64-linux-android', 'x86_64', 'x86_64'],
}
const targets = process.argv.slice(2).length ? process.argv.slice(2) : ['aarch64']
for (const t of targets) if (!TARGETS[t]) throw new Error(`Unknown target ${t}; use ${Object.keys(TARGETS).join(', ')}`)
if (!existsSync(join(native, 'ui/index.html'))) throw new Error('native/ui is missing; run npm run sync in native/ first')
if (!existsSync(join(android, 'keystore.properties'))) console.warn('No keystore.properties: the release APK will be unsigned')

const run = (cmd, args, cwd, env = process.env) => spawnSync(cmd, args, { cwd, env, stdio: 'inherit', shell: win }).status

for (const t of targets) {
  const [triple, abi] = TARGETS[t]
  const lib = join(tauri, 'target', triple, 'release/libjot_lib.so')
  const started = Date.now()
  // Fails at the symlink without Developer Mode; the library is built by then
  run('npx', ['tauri', 'android', 'build', '--apk', '--target', t], native)
  if (!existsSync(lib) || statSync(lib).mtimeMs < started - 1000) throw new Error(`Tauri did not build ${lib}; see the error above`)
  const dir = join(android, 'app/src/main/jniLibs', abi)
  mkdirSync(dir, { recursive: true })
  rmSync(join(dir, 'libjot_lib.so'), { force: true })
  copyFileSync(lib, join(dir, 'libjot_lib.so'))
  console.log(`copied ${triple} library into jniLibs/${abi}`)
}

// The CLI writes this after linking the library, so it is missing when the link fails
const conf = JSON.parse(readFileSync(join(tauri, 'tauri.conf.json'), 'utf8'))
mkdirSync(join(android, 'app/src/main/assets'), { recursive: true })
writeFileSync(join(android, 'app/src/main/assets/tauri.conf.json'), JSON.stringify({ ...conf, plugins: conf.plugins ?? {} }))

// Java's NIO puts a socket file in TEMP, which can fail there ("Unable to establish loopback
// connection"); a short folder of our own avoids it. Quoted because the home path may have spaces.
const uds = join(homedir(), '.jot', 'tmp')
mkdirSync(uds, { recursive: true })
const env = { ...process.env, JAVA_TOOL_OPTIONS: `${process.env.JAVA_TOOL_OPTIONS ?? ''} "-Djdk.net.unixdomain.tmpdir=${uds}"`.trim() }

const pick = i => targets.map(t => TARGETS[t][i]).join(',')
const skip = targets.flatMap(t => ['-x', `rustBuild${TARGETS[t][2][0].toUpperCase()}${TARGETS[t][2].slice(1)}Release`])
const status = run(win ? `"${join(android, 'gradlew.bat')}"` : './gradlew', ['assembleUniversalRelease', `-PabiList=${pick(1)}`, `-ParchList=${pick(2)}`,
  `-PtargetList=${targets.join(',')}`, ...skip, '-x', 'rustBuildUniversalRelease', '--console=plain'], android, env)
if (status !== 0) process.exit(status ?? 1)
console.log(`\n${join(android, 'app/build/outputs/apk/universal/release/app-universal-release.apk')}`)
