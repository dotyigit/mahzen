//
//  Second_ChanceApp.swift
//  Second Chance
//
//  Created by Omer Yigit Aker on 8.02.2026.
//

import SwiftUI
import CoreData

@main
struct Second_ChanceApp: App {
    let persistenceController = PersistenceController.shared

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environment(\.managedObjectContext, persistenceController.container.viewContext)
        }
    }
}
