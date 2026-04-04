package ch.qamwaq.ritomer.workpapers.infrastructure.storage

import com.google.cloud.storage.Storage
import com.google.cloud.storage.StorageOptions
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration

@Configuration(proxyBeanMethods = false)
@ConditionalOnProperty(
  prefix = "ritomer.workpapers.documents.storage",
  name = ["backend"],
  havingValue = "GCS"
)
class GcsStorageConfiguration {
  @Bean
  @ConditionalOnMissingBean(Storage::class)
  fun googleCloudStorage(): Storage =
    StorageOptions.getDefaultInstance().service
}
