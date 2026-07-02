package com.example.myapptest;

import com.example.myapp.Greeter;

import com.example.libs.TestSlogan;

/**
 * Minimal, dependency-free "unit test" for the sample workspace. It deliberately lives in its
 * own package (not {@code com.example.myapp}) so both imports below are real cross-project /
 * cross-jar references, not same-package access that would resolve without any classpath at all:
 *
 * <ul>
 *   <li>{@link Greeter}, from the MyApp project (resolved via the {@code projectDeps}
 *       entry in {@code antWorkbench.additionalClasspaths}, which adds MyApp as a source
 *       project reference in this project's generated .classpath).</li>
 *   <li>{@link TestSlogan}, from {@code MyApp/lib/test/sample-test-lib.jar} (resolved via
 *       the {@code test-classpath} path generated into this project's .classpath).</li>
 * </ul>
 *
 * If either import shows red squiggles in the editor, or this fails to compile/run,
 * classpath generation for this project needs to be (re)run.
 */
public class GreeterTest {
    public static void main(String[] args) {
        String actual = new Greeter().greet("Test");
        String expected = "Hello, Test!";
        if (!expected.equals(actual)) {
            throw new AssertionError("expected \"" + expected + "\" but was \"" + actual + "\"");
        }
        System.out.println("GreeterTest passed (" + TestSlogan.tagline() + ")");
    }
}
