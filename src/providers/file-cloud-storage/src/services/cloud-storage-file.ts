import { Storage } from '@google-cloud/storage';
import {
  FileTypes,
  Logger,
} from "@medusajs/framework/types"
import {
  AbstractFileProviderService,
  MedusaError,
} from "@medusajs/framework/utils"
import path from "path"
import { Readable } from "stream"
import { ulid } from "ulid"

type InjectedDependencies = {
  logger: Logger
}

interface CloudStorageFileServiceConfig {
  projectId: string;
  folder: string
  bucket: string
}

// const DEFAULT_UPLOAD_EXPIRATION_DURATION_SECONDS = 60 * 60

export class CloudStorageFileService extends AbstractFileProviderService {
  static identifier = "cloud-storage"
  protected config_: CloudStorageFileServiceConfig
  protected logger_: Logger
  protected client_: Storage

  constructor({ logger }: InjectedDependencies, options) {
    super()

    this.config_ = {
      projectId: options?.projectId,
      folder: options.folder,
      bucket: options.bucket,
    }
    this.logger_ = logger
    this.client_ = this.getClient()
  }

  protected getClient() {
    return new Storage({
      projectId: this?.config_?.projectId
    });
  }

  async upload(
    file: FileTypes.ProviderUploadFileDTO
  ): Promise<FileTypes.ProviderFileResultDTO> {
    if (!file) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, `No file provided`)
    }

    if (!file.filename) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `No filename provided`
      )
    }

    const parsedFilename = path.parse(file.filename)
    const fileKey = `${parsedFilename.name}-${ulid()}${parsedFilename.ext}`

    const content = Buffer.from(file.content, "binary");
    const url = `${this.config_.folder}/${fileKey}`

    try {
      await this.client_.bucket(this.config_.bucket).file(url).save(content);
      this.logger_.info(`File uploaded successfully: ${url}`);
    } catch (e) {
      this.logger_.error(e)
      throw e
    }

    return {
      url: `https://storage.googleapis.com/${this?.config_.bucket}/${url}`,
      key: fileKey,
    }
  }

  async delete(file: FileTypes.ProviderDeleteFileDTO): Promise<void> {
    try {
      await this.client_.bucket(this.config_.bucket).file(`${this.config_.folder}/${file?.fileKey}`).delete();
      this.logger_.info(`File deleted successfully: ${file?.fileKey}`);
    } catch (e) {
      this.logger_.error(e)
    }
  }

  async getPresignedDownloadUrl(
    fileData: FileTypes.ProviderGetFileDTO
  ): Promise<string> {
    const [url] = await this.client_
      .bucket(this.config_.bucket)
      .file(fileData.fileKey)
      .getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: Date.now() + 15 * 60 * 1000, // 15 minutes
    });

    return url;
  }

  async getAsStream(file: FileTypes.ProviderGetFileDTO): Promise<Readable> {
    if (!file?.filename) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `No filename provided`
      )
    }

    const fileKey = `${file.filename}`

    return await this.client_
      .bucket(this.config_.bucket)
      .file(fileKey)
      .createReadStream()
  }

  async getAsBuffer(file: FileTypes.ProviderGetFileDTO): Promise<Buffer> {
    if (!file?.filename) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `No filename provided`
      )
    }

    const fileKey = `${file.filename}`

    const [buffer] = await this.client_.bucket(this.config_.bucket).file(fileKey).download();
    return buffer;
  }
}
