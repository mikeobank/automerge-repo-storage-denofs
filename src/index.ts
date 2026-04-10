/**
 * @packageDocumentation
 * A `StorageAdapter` which stores data in the local filesystem (Deno)
 */

import type {
  Chunk,
  StorageAdapterInterface,
  StorageKey,
} from "@automerge/automerge-repo/slim"

export class DenoFSStorageAdapter implements StorageAdapterInterface {
  private baseDirectory: string
  private cache: { [key: string]: Uint8Array } = {}

  /**
   * @param baseDirectory - The path to the directory to store data in. Defaults to "./automerge-repo-data".
   */
  constructor(baseDirectory = "automerge-repo-data") {
    this.baseDirectory = baseDirectory
  }

  async load(keyArray: StorageKey): Promise<Uint8Array | undefined> {
    const key = getKey(keyArray)
    if (this.cache[key]) return this.cache[key]

    const filePath = this.getFilePath(keyArray)

    try {
      const data = await Deno.readFile(filePath)
      return data
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) return undefined
      throw error
    }
  }

  async save(keyArray: StorageKey, binary: Uint8Array): Promise<void> {
    const key = getKey(keyArray)
    this.cache[key] = binary

    const filePath = this.getFilePath(keyArray)
    const dir = filePath.substring(0, filePath.lastIndexOf("/"))

    await Deno.mkdir(dir, { recursive: true })
    await Deno.writeFile(filePath, binary)
  }

  async remove(keyArray: string[]): Promise<void> {
    delete this.cache[getKey(keyArray)]

    const filePath = this.getFilePath(keyArray)
    try {
      await Deno.remove(filePath)
    } catch (error) {
      if (!(error instanceof Deno.errors.NotFound)) throw error
    }
  }

  async loadRange(keyPrefix: StorageKey): Promise<Chunk[]> {
    const dirPath = this.getFilePath(keyPrefix)

    const cachedKeys = this.cachedKeys(keyPrefix)
    const diskFiles = await walkdir(dirPath)

    const diskKeys: string[] = diskFiles.map((fileName: string) => {
      const relative = fileName.startsWith(this.baseDirectory + "/")
        ? fileName.slice(this.baseDirectory.length + 1)
        : fileName
      const k = getKey([relative])
      return k.slice(0, 2) + k.slice(3)
    })

    const allKeys = [...new Set([...cachedKeys, ...diskKeys])]

    const chunks = await Promise.all(
      allKeys.map(async (keyString) => {
        const key: StorageKey = keyString.split("/")
        const data = await this.load(key)
        return { data, key }
      })
    )

    return chunks
  }

  async removeRange(keyPrefix: string[]): Promise<void> {
    this.cachedKeys(keyPrefix).forEach((key) => delete this.cache[key])

    const dirPath = this.getFilePath(keyPrefix)
    try {
      await Deno.remove(dirPath, { recursive: true })
    } catch (error) {
      if (!(error instanceof Deno.errors.NotFound)) throw error
    }
  }

  private cachedKeys(keyPrefix: string[]): string[] {
    const cacheKeyPrefixString = getKey(keyPrefix)
    return Object.keys(this.cache).filter((key) =>
      key.startsWith(cacheKeyPrefixString)
    )
  }

  private getFilePath(keyArray: string[]): string {
    const [firstKey, ...remainingKeys] = keyArray
    return [
      this.baseDirectory,
      firstKey.slice(0, 2),
      firstKey.slice(2),
      ...remainingKeys,
    ].join("/")
  }
}

// HELPERS

const getKey = (key: StorageKey): string => key.join("/")

/** Returns all files in a directory, recursively */
const walkdir = async (dirPath: string): Promise<string[]> => {
  const results: string[] = []
  try {
    for await (const entry of Deno.readDir(dirPath)) {
      const subpath = `${dirPath}/${entry.name}`
      if (entry.isDirectory) {
        results.push(...(await walkdir(subpath)))
      } else {
        results.push(subpath)
      }
    }
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) return []
    throw error
  }
  return results
}
