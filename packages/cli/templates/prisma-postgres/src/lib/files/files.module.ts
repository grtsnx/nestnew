import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { FILES_CLIENT, createFilesClientFromConfig } from 'src/middleware';
import { FilesService } from './files.service';

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: FILES_CLIENT,
      useFactory: (configService: ConfigService) =>
        createFilesClientFromConfig(configService),
      inject: [ConfigService],
    },
    FilesService,
  ],
  exports: [FilesService],
})
export class FilesModule {}
