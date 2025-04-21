-- --------------------------------------------------------

-- Máy chủ:                      hieutrollmc.tino.page

-- Server version:               10.3.34-MariaDB-cll-lve - MariaDB Server

-- Server OS:                    Linux

-- HeidiSQL Phiên bản:           12.6.0.6765

-- --------------------------------------------------------

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;

/*!40101 SET NAMES utf8 */;

/*!50503 SET NAMES utf8mb4 */;

/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;

/*!40103 SET TIME_ZONE='+00:00' */;

/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;

/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;

/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

-- Dumping database structure for satancra_chatapp

CREATE DATABASE IF NOT EXISTS `satancra_chatapp` /*!40100 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci */;

USE `satancra_chatapp`;

-- Dumping structure for table satancra_chatapp.attachmentmessage

CREATE TABLE IF NOT EXISTS `attachmentmessage` (

  `MessageID` int(11) DEFAULT NULL,

  `Content` mediumtext COLLATE utf8mb4_unicode_ci DEFAULT NULL,

  `AttachmentUrl` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,

  `Type` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,

  KEY `MessageID` (`MessageID`),

  CONSTRAINT `attachmentmessage_ibfk_1` FOREIGN KEY (`MessageID`) REFERENCES `message` (`MessageID`)

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Data exporting was unselected.

-- Dumping structure for table satancra_chatapp.chat

CREATE TABLE IF NOT EXISTS `chat` (

  `ChatID` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,

  `CreatedDate` datetime DEFAULT NULL,

  `Type` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,

  `Status` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,

  `Owner` int(11) DEFAULT NULL,

  PRIMARY KEY (`ChatID`),

  KEY `Owner` (`Owner`),

  CONSTRAINT `chat_ibfk_1` FOREIGN KEY (`Owner`) REFERENCES `user` (`UserID`)

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Data exporting was unselected.

-- Dumping structure for table satancra_chatapp.chatmember

CREATE TABLE IF NOT EXISTS `chatmember` (

  `ChatID` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,

  `UserID` int(11) DEFAULT NULL,

  `Role` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,

  `AddedTimestamp` datetime DEFAULT NULL,

  KEY `UserID` (`UserID`),

  KEY `chatmember_ibfk_1` (`ChatID`),

  CONSTRAINT `chatmember_ibfk_1` FOREIGN KEY (`ChatID`) REFERENCES `chat` (`ChatID`),

  CONSTRAINT `chatmember_ibfk_2` FOREIGN KEY (`UserID`) REFERENCES `user` (`UserID`)

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Data exporting was unselected.

-- Dumping structure for table satancra_chatapp.contact

CREATE TABLE IF NOT EXISTS `contact` (

  `UserID` int(11) DEFAULT NULL,

  `ContactID` int(11) DEFAULT NULL,

  `ContactName` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,

  `Status` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,

  KEY `UserID` (`UserID`),

  KEY `ContactID` (`ContactID`),

  CONSTRAINT `contact_ibfk_1` FOREIGN KEY (`UserID`) REFERENCES `user` (`UserID`),

  CONSTRAINT `contact_ibfk_2` FOREIGN KEY (`ContactID`) REFERENCES `user` (`UserID`)

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Data exporting was unselected.

-- Dumping structure for table satancra_chatapp.friendrequest

CREATE TABLE IF NOT EXISTS `friendrequest` (

  `NotificationID` int(11) DEFAULT NULL,

  `Status` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,

  KEY `NotificationID` (`NotificationID`),

  CONSTRAINT `friendrequest_ibfk_1` FOREIGN KEY (`NotificationID`) REFERENCES `notification` (`NotificationID`)

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Data exporting was unselected.

-- Dumping structure for table satancra_chatapp.groupinvite

CREATE TABLE IF NOT EXISTS `groupinvite` (

  `NotificationID` int(11) DEFAULT NULL,

  `Status` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,

  KEY `NotificationID` (`NotificationID`),

  CONSTRAINT `groupinvite_ibfk_1` FOREIGN KEY (`NotificationID`) REFERENCES `notification` (`NotificationID`)

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Data exporting was unselected.

-- Dumping structure for table satancra_chatapp.message

CREATE TABLE IF NOT EXISTS `message` (

  `MessageID` int(11) NOT NULL AUTO_INCREMENT,

  `ChatID` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,

  `Type` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,

  `UserID` int(11) DEFAULT NULL,

  `Reactions` mediumtext COLLATE utf8mb4_unicode_ci DEFAULT NULL,

  `Timestamp` datetime DEFAULT NULL,

  PRIMARY KEY (`MessageID`),

  KEY `UserID` (`UserID`),

  KEY `message_ibfk_1` (`ChatID`),

  CONSTRAINT `message_ibfk_1` FOREIGN KEY (`ChatID`) REFERENCES `chat` (`ChatID`),

  CONSTRAINT `message_ibfk_2` FOREIGN KEY (`UserID`) REFERENCES `user` (`UserID`)

) ENGINE=InnoDB AUTO_INCREMENT=116 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Data exporting was unselected.

-- Dumping structure for table satancra_chatapp.notification

CREATE TABLE IF NOT EXISTS `notification` (

  `NotificationID` int(11) NOT NULL AUTO_INCREMENT,

  `Type` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,

  `Sender` int(11) DEFAULT NULL,

  `Receiver` int(11) DEFAULT NULL,

  `CreatedAt` datetime DEFAULT NULL,

  `Details` mediumtext COLLATE utf8mb4_unicode_ci DEFAULT NULL,

  PRIMARY KEY (`NotificationID`),

  KEY `Sender` (`Sender`),

  KEY `Receiver` (`Receiver`),

  CONSTRAINT `notification_ibfk_1` FOREIGN KEY (`Sender`) REFERENCES `user` (`UserID`),

  CONSTRAINT `notification_ibfk_2` FOREIGN KEY (`Receiver`) REFERENCES `user` (`UserID`)

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Data exporting was unselected.

-- Dumping structure for table satancra_chatapp.settings

CREATE TABLE IF NOT EXISTS `settings` (

  `UserID` int(11) DEFAULT NULL,

  `Language` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,

  `DarkMode` tinyint(1) DEFAULT NULL,

  KEY `UserID` (`UserID`),

  CONSTRAINT `settings_ibfk_1` FOREIGN KEY (`UserID`) REFERENCES `user` (`UserID`)

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Data exporting was unselected.

-- Dumping structure for table satancra_chatapp.textmessage

CREATE TABLE IF NOT EXISTS `textmessage` (

  `MessageID` int(11) DEFAULT NULL,

  `Content` mediumtext COLLATE utf8mb4_unicode_ci DEFAULT NULL,

  `Type` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,

  KEY `MessageID` (`MessageID`),

  CONSTRAINT `textmessage_ibfk_1` FOREIGN KEY (`MessageID`) REFERENCES `message` (`MessageID`)

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Data exporting was unselected.

-- Dumping structure for table satancra_chatapp.user

CREATE TABLE IF NOT EXISTS `user` (

  `UserID` int(11) NOT NULL,

  `Name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,

  `Password` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,

  `Email` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,

  `Birthday` date DEFAULT NULL,

  `Location` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,

  `ImageUrl` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,

  `Phone` varchar(15) COLLATE utf8mb4_unicode_ci DEFAULT NULL,

  PRIMARY KEY (`UserID`)

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Data exporting was unselected.



