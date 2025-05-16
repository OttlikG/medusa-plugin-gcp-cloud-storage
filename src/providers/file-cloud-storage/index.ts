import { ModuleProvider, Modules } from "@medusajs/framework/utils"
import { CloudStorageFileService } from "./src/services/cloud-storage-file"

const services = [CloudStorageFileService]

export default ModuleProvider(Modules.FILE, {
  services,
})