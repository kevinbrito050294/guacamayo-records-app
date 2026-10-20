-- Compras de proveedor separadas del inventario fisico vendible.
-- Una compra no aumenta stock hasta que un item se incorpora al inventario.

CREATE TABLE IF NOT EXISTS `compras` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `proveedor` VARCHAR(191) NOT NULL,
  `proveedor_pais` VARCHAR(80) NOT NULL DEFAULT 'Venezuela',
  `responsable_admin_id` INT NOT NULL,
  `estado` VARCHAR(30) NOT NULL DEFAULT 'borrador',
  `fecha_compra` DATE NULL,
  `tasa_ars_usdt` DECIMAL(18,6) NULL,
  `tasa_ves_usdt` DECIMAL(18,6) NULL,
  `total_productos_ves` DECIMAL(18,6) NOT NULL DEFAULT 0,
  `total_productos_usdt` DECIMAL(18,6) NOT NULL DEFAULT 0,
  `total_puesto_usdt` DECIMAL(18,6) NOT NULL DEFAULT 0,
  `observaciones` TEXT NULL,
  `creado_en` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `actualizado_en` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_compras_estado` (`estado`),
  KEY `idx_compras_responsable` (`responsable_admin_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `compra_items` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `compra_id` BIGINT UNSIGNED NOT NULL,
  `codigo_proveedor` VARCHAR(100) NULL,
  `titulo` VARCHAR(191) NOT NULL,
  `artista` VARCHAR(191) NOT NULL,
  `genero` VARCHAR(100) NULL,
  `calidad` VARCHAR(20) NULL,
  `pais_origen` VARCHAR(100) NULL,
  `descripcion` TEXT NULL,
  `imagen_url` TEXT NULL,
  `cantidad_comprada` INT NOT NULL,
  `cantidad_recibida` INT NOT NULL DEFAULT 0,
  `precio_unitario_ves` DECIMAL(18,6) NOT NULL DEFAULT 0,
  `costo_unitario_usdt` DECIMAL(18,6) NOT NULL DEFAULT 0,
  `costo_unitario_ars` DECIMAL(18,6) NOT NULL DEFAULT 0,
  `vinilo_id` BIGINT UNSIGNED NULL,
  `estado` VARCHAR(30) NOT NULL DEFAULT 'pendiente_recepcion',
  `creado_en` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `actualizado_en` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_compra_items_compra` (`compra_id`),
  KEY `idx_compra_items_estado` (`estado`),
  KEY `idx_compra_items_vinilo` (`vinilo_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
