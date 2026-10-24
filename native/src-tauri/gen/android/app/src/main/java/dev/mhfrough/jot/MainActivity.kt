package dev.mhfrough.jot

import android.graphics.Color
import android.os.Bundle
import android.view.View
import androidx.activity.SystemBarStyle
import androidx.activity.enableEdgeToEdge
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat

class MainActivity : TauriActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    // Draw behind transparent system bars, with dark or light icons to suit the day or night theme
    enableEdgeToEdge(
      statusBarStyle = SystemBarStyle.auto(Color.TRANSPARENT, Color.TRANSPARENT),
      navigationBarStyle = SystemBarStyle.auto(Color.TRANSPARENT, Color.TRANSPARENT),
    )
    super.onCreate(savedInstanceState)
    // Then keep Jot clear of them: pad by the status bar, the navigation bar, a camera cutout and the
    // keyboard. With the keyboard open the page shrinks above it, so the note's toolbar stays at the
    // top, instead of the whole page being pushed up to keep the caret in view.
    val content = findViewById<View>(android.R.id.content)
    ViewCompat.setOnApplyWindowInsetsListener(content) { view, insets ->
      val gaps = insets.getInsets(
        WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout() or WindowInsetsCompat.Type.ime()
      )
      view.setPadding(gaps.left, gaps.top, gaps.right, gaps.bottom)
      WindowInsetsCompat.CONSUMED
    }
  }
}
