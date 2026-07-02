package com.example.myapp;

import com.example.libs.Slogan;

public class App {
    public static void main(String[] args) {
        System.out.println(new Greeter().greet("Ant Workbench") + " (" + Slogan.tagline() + ")");
    }
}
